from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Set, Tuple
import uvicorn
import os
import json
import numpy as np
import cv2
import cloudinary
import cloudinary.uploader
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import DBSCAN
from PIL import Image, ExifTags
import pillow_heif
import io
from collections import defaultdict

# Import your custom engine
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

# Cloudinary Config
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

DB_PHOTOS = "database.json"
DB_USERS = "users.json"

# ============================================================================
# CONFIGURATION
# ============================================================================
MAX_PHOTOS = 20
FACE_SIMILARITY_THRESHOLD = 0.68  # Face matching threshold
PRIMARY_PERSON_THRESHOLD = 0.68   # Same as above for consistency
COLOR_SEPARATION_THRESHOLD = 40   # Only used to separate same people, different outfits

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

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

def extract_dominant_color(img_np, face_location=None):
    """Simple dominant color extraction for outfit separation"""
    h, w, _ = img_np.shape
    
    if face_location and isinstance(face_location, dict):
        y = face_location.get('y', 0)
        h_face = face_location.get('h', 0)
        x = face_location.get('x', 0)
        w_face = face_location.get('w', 0)
        
        # Chest region
        top = min(h, y + h_face + 10)
        bottom = min(h, top + int(h_face * 0.7))
        left = max(0, x + int(w_face * 0.3))
        right = min(w, x + int(w_face * 0.7))
        
        roi = img_np[top:bottom, left:right]
    else:
        roi = img_np[int(h*0.4):int(h*0.6), int(w*0.4):int(w*0.6)]
    
    if roi.size == 0 or roi.shape[0] < 5 or roi.shape[1] < 5:
        return np.array([0, 0, 0])
    
    rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
    pixels = rgb.reshape(-1, 3).astype(np.float32)
    
    # Simple k-means
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, _, center = cv2.kmeans(pixels, 1, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
    
    return center[0]

def get_person_signature(face_embedding, all_person_ids, person_embeddings):
    """
    Match a face to a known person ID.
    Returns: person_id (int) or None if no match
    """
    for person_id, ref_embeddings in person_embeddings.items():
        for ref_emb in ref_embeddings:
            sim = cosine_similarity([face_embedding], [ref_emb])[0][0]
            if sim > FACE_SIMILARITY_THRESHOLD:
                return person_id
    return None

def get_photo_signature(photo_data, person_embeddings):
    """
    Create a signature for who's in the photo.
    Returns: frozenset of person IDs (so it's hashable for grouping)
    """
    people_in_photo = set()
    
    for face_emb in photo_data["faces"]:
        person_id = get_person_signature(face_emb, person_embeddings.keys(), person_embeddings)
        if person_id is not None:
            people_in_photo.add(person_id)
    
    return frozenset(people_in_photo)

# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

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

# ============================================================================
# NEW CLUSTERING APPROACH - GROUP BY WHO'S IN THE PHOTO
# ============================================================================

@app.post("/upload-photos/")
async def upload_photos(files: List[UploadFile] = File(...), username: str = Form(...)):
    
    if len(files) > MAX_PHOTOS:
        raise HTTPException(
            status_code=400, 
            detail=f"Too many files. Maximum {MAX_PHOTOS} photos allowed."
        )
    
    processed_data = []
    
    print(f"\n{'='*70}")
    print(f"🚀 SMART CLUSTERING - {len(files)} files")
    print(f"{'='*70}\n")
    
    # ========================================================================
    # PHASE 1: Process each photo
    # ========================================================================
    
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
            
            print(f"[{idx+1}/{len(files)}] {file.filename}")
            
            # Get faces
            face_data = ml.get_face_embeddings(img_np)
            face_embeddings = [f["embedding"] for f in face_data]
            face_locations = [f["location"] for f in face_data]
            
            # Get color for primary person (for outfit separation later)
            primary_color = [0, 0, 0]
            if len(face_locations) > 0:
                primary_color = extract_dominant_color(img_np, face_locations[0]).tolist()
            
            # Upload to Cloudinary
            buf = io.BytesIO()
            img_rgb.save(buf, format="JPEG")
            buf.seek(0)
            res = cloudinary.uploader.upload(buf.getvalue(), folder="memorymap")
            
            processed_data.append({
                "url": res.get("secure_url"),
                "faces": face_embeddings,
                "face_locations": face_locations,
                "face_count": len(face_embeddings),
                "primary_color": primary_color,
                "filename": file.filename
            })
            
            print(f"    ✓ {len(face_embeddings)} faces detected\n")
            
        except Exception as e:
            print(f"    ❌ Error: {e}\n")
            import traceback
            traceback.print_exc()

    if not processed_data:
        return {"status": "error", "message": "No photos processed"}

    # ========================================================================
    # PHASE 2: Identify ALL unique people across all photos
    # ========================================================================
    
    print(f"{'='*70}")
    print(f"📊 STEP 1: IDENTIFYING ALL PEOPLE")
    print(f"{'='*70}\n")
    
    all_faces = []
    face_to_photo = []
    
    for photo_idx, photo in enumerate(processed_data):
        for face in photo["faces"]:
            all_faces.append(face)
            face_to_photo.append(photo_idx)
    
    if not all_faces:
        print("⚠️ No faces detected - all photos are scenery\n")
        user_data = {
            "clusters": {}, 
            "extras": [p["url"] for p in processed_data],
            "extras_info": [
                {"url": p["url"], "filename": p["filename"], "face_count": 0}
                for p in processed_data
            ]
        }
        
        db = load_json(DB_PHOTOS)
        db[username] = user_data
        save_json(DB_PHOTOS, db)
        
        return {"status": "success", "data": user_data}
    
    # Cluster ALL faces to identify unique people
    faces_array = np.array(all_faces)
    clustering = DBSCAN(eps=0.32, min_samples=1, metric='cosine')  # min_samples=1 to catch everyone
    labels = clustering.fit_predict(faces_array)
    
    # Build person_id -> embeddings mapping
    person_embeddings = defaultdict(list)
    for idx, label in enumerate(labels):
        if label != -1:
            person_embeddings[label].append(faces_array[idx])
    
    # Find primary person (appears most)
    person_photo_counts = defaultdict(set)
    for idx, label in enumerate(labels):
        if label != -1:
            photo_idx = face_to_photo[idx]
            person_photo_counts[label].add(photo_idx)
    
    if not person_photo_counts:
        print("⚠️ Could not identify people\n")
        user_data = {
            "clusters": {}, 
            "extras": [p["url"] for p in processed_data],
            "extras_info": [
                {"url": p["url"], "filename": p["filename"], "face_count": p["face_count"]}
                for p in processed_data
            ]
        }
        
        db = load_json(DB_PHOTOS)
        db[username] = user_data
        save_json(DB_PHOTOS, db)
        
        return {"status": "success", "data": user_data}
    
    primary_person_id = max(person_photo_counts.keys(), key=lambda k: len(person_photo_counts[k]))
    primary_person_photos = person_photo_counts[primary_person_id]
    
    print(f"✓ Identified {len(person_embeddings)} unique people")
    print(f"✓ Primary person (ID={primary_person_id}) appears in {len(primary_person_photos)} photos\n")
    
    # ========================================================================
    # PHASE 3: Group photos by WHO'S IN THEM
    # ========================================================================
    
    print(f"{'='*70}")
    print(f"📊 STEP 2: GROUPING BY PEOPLE COMBINATIONS")
    print(f"{'='*70}\n")
    
    # Create signature for each photo (which people are in it)
    photo_signatures = []
    for photo_idx, photo in enumerate(processed_data):
        signature = get_photo_signature(photo, person_embeddings)
        photo_signatures.append(signature)
        
        people_str = ", ".join([f"Person{pid}" for pid in sorted(signature)])
        print(f"{photo['filename']}: {people_str if people_str else 'No recognized people'}")
    
    print()
    
    # Group photos by signature
    signature_groups = defaultdict(list)
    for photo_idx, signature in enumerate(photo_signatures):
        # Only group if primary person is in the photo
        if primary_person_id in signature:
            signature_groups[signature].append(photo_idx)
    
    print(f"✓ Created {len(signature_groups)} groups based on people combinations\n")
    
    # ========================================================================
    # PHASE 4: Sub-divide groups by outfit (if same people, different outfits)
    # ========================================================================
    
    print(f"{'='*70}")
    print(f"📊 STEP 3: SEPARATING BY OUTFIT (WITHIN SAME PEOPLE)")
    print(f"{'='*70}\n")
    
    final_events = []
    
    for signature, photo_indices in signature_groups.items():
        if len(photo_indices) == 1:
            # Only one photo with this combination - no need to sub-divide
            photo = processed_data[photo_indices[0]]
            final_events.append({
                "photos": [photo["url"]],
                "filenames": [photo["filename"]],
                "signature": signature
            })
            print(f"Single photo group: {photo['filename']}")
        else:
            # Multiple photos with same people - check if different outfits
            # Use simple color-based sub-clustering
            colors = [np.array(processed_data[idx]["primary_color"]) for idx in photo_indices]
            
            # Sub-cluster by color
            sub_events = []
            used = set()
            
            for i, ref_idx in enumerate(photo_indices):
                if i in used:
                    continue
                
                ref_color = colors[i]
                sub_event = {
                    "photos": [processed_data[ref_idx]["url"]],
                    "filenames": [processed_data[ref_idx]["filename"]],
                    "signature": signature
                }
                used.add(i)
                
                # Find similar outfit colors
                for j, other_idx in enumerate(photo_indices):
                    if j in used:
                        continue
                    
                    other_color = colors[j]
                    color_dist = np.linalg.norm(ref_color - other_color)
                    
                    if color_dist < COLOR_SEPARATION_THRESHOLD:
                        sub_event["photos"].append(processed_data[other_idx]["url"])
                        sub_event["filenames"].append(processed_data[other_idx]["filename"])
                        used.add(j)
                
                sub_events.append(sub_event)
            
            final_events.extend(sub_events)
            
            print(f"Multi-photo group ({len(photo_indices)} photos) split into {len(sub_events)} outfit-based events")
            for se in sub_events:
                for fname in se["filenames"]:
                    print(f"  - {fname}")
            print()
    
    # ========================================================================
    # PHASE 5: Everything else goes to extras (no primary person)
    # ========================================================================
    
    photos_in_events = set()
    for event in final_events:
        for fname in event["filenames"]:
            for idx, photo in enumerate(processed_data):
                if photo["filename"] == fname:
                    photos_in_events.add(idx)
    
    extras = []
    extras_info = []
    
    for idx, photo in enumerate(processed_data):
        if idx not in photos_in_events:
            extras.append(photo["url"])
            extras_info.append({
                "url": photo["url"],
                "filename": photo["filename"],
                "face_count": photo["face_count"]
            })
    
    # ========================================================================
    # FINAL RESULTS
    # ========================================================================
    
    print(f"{'='*70}")
    print(f"🎉 FINAL CLUSTERING RESULTS")
    print(f"{'='*70}\n")
    
    for i, event in enumerate(final_events):
        people_str = ", ".join([f"Person{pid}" for pid in sorted(event["signature"])])
        print(f"Event_{i+1}: {len(event['photos'])} photos - {people_str}")
        for fname in event['filenames']:
            print(f"  - {fname}")
        print()
    
    if extras:
        print(f"Scenery/Extras: {len(extras)} photos")
        for info in extras_info:
            print(f"  - {info['filename']} ({info['face_count']} faces)")
        print()
    
    user_data = {
        "clusters": {f"Event_{i+1}": event["photos"] for i, event in enumerate(final_events)},
        "extras": extras,
        "extras_info": extras_info
    }

    db = load_json(DB_PHOTOS)
    db[username] = user_data
    save_json(DB_PHOTOS, db)
    
    return {"status": "success", "data": user_data}

@app.get("/photos/{username}")
def get_photos(username: str):
    data = load_json(DB_PHOTOS)
    return data.get(username, {"clusters": {}, "extras": [], "extras_info": []})

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)