"""
SIMPLE & RELIABLE Photo Clustering
===================================
Logic:
1. Find primary person (most frequent face)
2. Group photos with primary person together
3. Split ONLY when clearly different people appear
4. No time-based logic (causes incorrect splits)
"""

from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import uvicorn
import os
import json
import numpy as np
import cv2
import cloudinary
import cloudinary.uploader
from datetime import datetime, timedelta
from dotenv import load_dotenv
from PIL import Image, ExifTags
import pillow_heif
import io

import ml_engine as ml

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

DB_PHOTOS = "database.json"
DB_USERS = "users.json"

def save_json(filename, data):
    with open(filename, "w") as f:
        json.dump(data, f, indent=4)

def load_json(filename):
    if not os.path.exists(filename):
        return {} if filename == DB_PHOTOS else []
    with open(filename, "r") as f:
        try:
            data = json.load(f)
            return data if data else ({} if filename == DB_PHOTOS else [])
        except:
            return {} if filename == DB_PHOTOS else []

def cosine_sim(v1, v2):
    v1, v2 = np.array(v1), np.array(v2)
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-10)

def face_matches(face1, face2, threshold=0.60):
    return cosine_sim(face1, face2) > threshold

def find_primary_person(all_photos):
    """Find the person appearing most frequently"""
    all_faces = []
    face_to_photo = []
    
    for idx, photo in enumerate(all_photos):
        for face in photo["faces"]:
            all_faces.append(face)
            face_to_photo.append(idx)
    
    if not all_faces:
        return None, set()
    
    # Simple clustering: pick first face, find all similar faces
    clusters = []
    used = set()
    
    for i, face1 in enumerate(all_faces):
        if i in used:
            continue
        
        cluster = [i]
        used.add(i)
        
        for j, face2 in enumerate(all_faces):
            if j in used:
                continue
            if face_matches(face1, face2, threshold=0.58):
                cluster.append(j)
                used.add(j)
        
        clusters.append(cluster)
    
    # Find largest cluster
    primary_cluster = max(clusters, key=len)
    primary_faces = [all_faces[i] for i in primary_cluster]
    primary_photos = set(face_to_photo[i] for i in primary_cluster)
    
    return primary_faces, primary_photos

def photo_has_person(photo_faces, person_faces, threshold=0.60):
    """Check if photo contains a specific person"""
    for photo_face in photo_faces:
        for person_face in person_faces:
            if face_matches(photo_face, person_face, threshold):
                return True
    return False

def get_shared_people(photo1_faces, photo2_faces, threshold=0.60):
    """Count how many people appear in both photos"""
    matches = 0
    for face1 in photo1_faces:
        for face2 in photo2_faces:
            if face_matches(face1, face2, threshold):
                matches += 1
                break
    return matches

@app.post("/signup/")
async def signup(user: dict = Body(...)):
    users = load_json(DB_USERS)
    users.append(user)
    save_json(DB_USERS, users)
    return {"status": "success"}

@app.post("/login/")
async def login(credentials: dict = Body(...)):
    users = load_json(DB_USERS)
    for user in users:
        if user.get('username') == credentials.get('username') and user.get('password') == credentials.get('password'):
            return {"status": "success", "user": user['username']}
    raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/upload-photos/")
async def upload_photos(files: List[UploadFile] = File(...), username: str = Form(...)):
    print(f"\n{'='*80}")
    print(f"📸 SIMPLE CLUSTERING - {len(files)} files")
    print(f"{'='*80}\n")
    
    processed = []
    
    # STEP 1: Process all photos
    print("STEP 1: Processing photos...\n")
    
    for idx, file in enumerate(files):
        try:
            file_bytes = await file.read()
            
            if file.filename.lower().endswith(".heic"):
                heif_file = pillow_heif.read_heif(file_bytes)
                image = Image.frombytes(heif_file.mode, heif_file.size, heif_file.data, "raw")
            else:
                image = Image.open(io.BytesIO(file_bytes))
            
            img_rgb = image.convert("RGB")
            img_np = cv2.cvtColor(np.array(img_rgb), cv2.COLOR_RGB2BGR)
            
            # Get faces
            face_data = ml.get_face_embeddings(img_np)
            faces = [f["embedding"] for f in face_data]
            
            # Upload
            buf = io.BytesIO()
            img_rgb.save(buf, format="JPEG")
            buf.seek(0)
            res = cloudinary.uploader.upload(buf.getvalue(), folder="memorymap")
            
            processed.append({
                "url": res.get("secure_url"),
                "filename": file.filename,
                "faces": faces
            })
            
            print(f"[{idx+1}/{len(files)}] {file.filename} - {len(faces)} face(s)")
            
        except Exception as e:
            print(f"[{idx+1}/{len(files)}] ❌ {file.filename}: {e}")
    
    if not processed:
        return {"status": "error", "message": "No photos processed"}
    
    print(f"\n{'='*80}")
    print("STEP 2: Finding primary person...\n")
    
    primary_faces, primary_photo_indices = find_primary_person(processed)
    
    if not primary_faces:
        print("⚠️ No faces detected - all photos go to extras\n")
        return {
            "status": "success",
            "data": {
                "clusters": {},
                "extras": [p["url"] for p in processed]
            }
        }
    
    print(f"✓ Primary person found in {len(primary_photo_indices)} photos")
    print(f"✓ Primary person has {len(primary_faces)} face samples\n")
    
    # STEP 3: Group photos with primary person
    print(f"{'='*80}")
    print("STEP 3: Creating events...\n")
    
    events = []
    used_indices = set()
    
    for ref_idx in sorted(primary_photo_indices):
        if ref_idx in used_indices:
            continue
        
        ref_photo = processed[ref_idx]
        
        # Start new event
        event = {
            "photos": [ref_photo["url"]],
            "filenames": [ref_photo["filename"]],
            "all_faces": ref_photo["faces"].copy()
        }
        used_indices.add(ref_idx)
        
        print(f"Event {len(events)+1}: {ref_photo['filename']}")
        
        # Find photos with SAME people (not just primary person)
        for other_idx in sorted(primary_photo_indices):
            if other_idx in used_indices:
                continue
            
            other_photo = processed[other_idx]
            
            # Check: do these photos share the same people?
            shared = get_shared_people(ref_photo["faces"], other_photo["faces"])
            
            # If at least 50% of people match, same event
            min_people = min(len(ref_photo["faces"]), len(other_photo["faces"]))
            if min_people > 0 and (shared / min_people) >= 0.5:
                event["photos"].append(other_photo["url"])
                event["filenames"].append(other_photo["filename"])
                event["all_faces"].extend(other_photo["faces"])
                used_indices.add(other_idx)
                print(f"  + {other_photo['filename']} (shared: {shared}/{min_people})")
        
        events.append(event)
        print()
    
    print(f"✓ Created {len(events)} events\n")
    
    # STEP 4: Handle photos without primary person
    print(f"{'='*80}")
    print("STEP 4: Checking photos without primary person...\n")
    
    extras = []
    
    for idx, photo in enumerate(processed):
        if idx in used_indices:
            continue
        
        # Try to match to existing event by checking for shared people
        matched = False
        
        for event in events:
            shared = get_shared_people(photo["faces"], event["all_faces"])
            
            if len(photo["faces"]) > 0 and (shared / len(photo["faces"])) >= 0.3:
                event["photos"].append(photo["url"])
                event["filenames"].append(photo["filename"])
                used_indices.add(idx)
                matched = True
                print(f"✓ {photo['filename']} matched to event (shared people: {shared})")
                break
        
        if not matched:
            extras.append(photo["url"])
            print(f"→ {photo['filename']} moved to extras")
    
    print(f"\n{'='*80}")
    print("🎉 FINAL RESULTS")
    print(f"{'='*80}\n")
    
    for i, event in enumerate(events):
        print(f"Event_{i+1}: {len(event['photos'])} photos")
        for fname in event['filenames']:
            print(f"  - {fname}")
        print()
    
    if extras:
        print(f"Extras: {len(extras)} photos\n")
    
    user_data = {
        "clusters": {f"Event_{i+1}": event["photos"] for i, event in enumerate(events)},
        "extras": extras
    }
    
    db = load_json(DB_PHOTOS)
    db[username] = user_data
    save_json(DB_PHOTOS, db)
    
    return {"status": "success", "data": user_data}

@app.get("/photos/{username}")
def get_photos(username: str):
    data = load_json(DB_PHOTOS)
    return data.get(username, {"clusters": {}, "extras": []})

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)