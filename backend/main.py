from fastapi import FastAPI, UploadFile, File, Body, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from pillow_heif import register_heif_opener
from typing import List
import io
import uvicorn
import cloudinary
import cloudinary.uploader
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from ml_engine import get_image_date, get_dominant_color
from layout_engine import generate_layout

load_dotenv()
register_heif_opener()
# --- CONFIG ---
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

app = FastAPI(title="MemoryMap Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE HELPERS ---
DB_PHOTOS = "database.json"
DB_USERS = "users.json"

def save_to_db(filename, data, is_list=False):
    if os.path.exists(filename):
        with open(filename, "r") as f:
            try: current = json.load(f)
            except: current = []
    else:
        current = []
    
    if is_list:
        current.extend(data)
    else:
        current.append(data)
        
    with open(filename, "w") as f:
        json.dump(current, f, indent=4)

def get_users():
    if not os.path.exists(DB_USERS): return []
    with open(DB_USERS, "r") as f:
        try: return json.load(f)
        except: return []

# --- MODELS ---
class UserSignup(BaseModel):
    username: str
    password: str
    role: str # 'admin' or 'user'

class UserLogin(BaseModel):
    username: str
    password: str

# --- AUTH ENDPOINTS ---

@app.post("/signup/")
def signup(user: UserSignup):
    users = get_users()
    for u in users:
        if u["username"] == user.username:
            raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = {
        "username": user.username,
        "password": user.password,
        "role": user.role,
        "created_at": str(datetime.now())
    }
    
    save_to_db(DB_USERS, new_user)
    return {"status": "success", "message": "User created", "user": new_user}

@app.post("/login/")
def login(user: UserLogin):
    users = get_users()
    for u in users:
        if u["username"] == user.username and u["password"] == user.password:
            return {
                "status": "success", 
                "message": "Login successful", 
                "role": u["role"],
                "username": u["username"]
            }
    
    raise HTTPException(status_code=401, detail="Invalid credentials")

# --- PHOTO ENDPOINTS ---

@app.post("/upload-photos/")
async def upload_photos(
    files: List[UploadFile] = File(...),
    username: str = Form(...) # <--- Receive Username
):
    processed_records = []
    for file in files:
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            extracted_date = get_image_date(image)
            extracted_color = get_dominant_color(image)
            
            file.file.seek(0)
            upload_result = cloudinary.uploader.upload(file.file, folder="memorymap_uploads")
            
            new_record = {
                "id": upload_result.get("public_id"),
                "owner": username, # <--- Save Owner
                "filename": file.filename,
                "image_url": upload_result.get("secure_url"),
                "bucket_date": extracted_date,
                "bucket_color": extracted_color,
                "created_at": str(datetime.now())
            }
            processed_records.append(new_record)
        except Exception as e:
            print(f"Error processing {file.filename}: {e}")
            continue

    save_to_db(DB_PHOTOS, processed_records, is_list=True)
    return {"status": "success", "count": len(processed_records), "data": processed_records}

@app.get("/photos/")
def get_photos(username: str): # <--- Filter by Username
    if not os.path.exists(DB_PHOTOS): return []
    with open(DB_PHOTOS, "r") as f:
        try: all_photos = json.load(f)
        except: return []
    
    # Filter photos for this specific user
    user_photos = [p for p in all_photos if p.get("owner") == username]
    return user_photos

@app.post("/auto-layout/")
def get_auto_layout(photos: List[dict] = Body(...)):
    return generate_layout(photos)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)