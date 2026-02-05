from PIL import Image, ExifTags
import numpy as np
import cv2
import colorsys
from datetime import datetime
from deepface import DeepFace
from sklearn.cluster import DBSCAN
from sklearn.metrics.pairwise import cosine_similarity

# --- ML CONFIG ---
THUMBNAIL_SIZE = (100, 100)

def get_face_embeddings(img_np):
    """Detects faces and returns 128-d vectors with their locations."""
    try:
        # Try multiple backends for better detection
        backends = ['opencv', 'ssd', 'retinaface']
        
        for backend in backends:
            try:
                objs = DeepFace.represent(
                    img_np, 
                    model_name="VGG-Face", 
                    enforce_detection=False, 
                    detector_backend=backend
                )
                
                if objs and len(objs) > 0:
                    results = []
                    for obj in objs:
                        confidence = obj.get("face_confidence", 1.0)
                        if confidence > 0.5:
                            embedding = obj.get("embedding", [])
                            facial_area = obj.get("facial_area", {})
                            results.append({
                                "embedding": embedding,
                                "location": facial_area
                            })
                    
                    if results:
                        print(f"    ✓ Found {len(results)} faces using {backend}")
                        return results
            except:
                continue
        
        print(f"    ⚠ No faces found with any detector")
        return []
        
    except Exception as e:
        print(f"    ⚠ Error in face detection: {e}")
        return []

def get_outfit_signature(img_np, face_locations=None):
    """
    Extracts PRECISE outfit color signature from clothing region ONLY.
    Focuses on dominant clothing colors, not background.
    """
    h, w, _ = img_np.shape
    
    # Default to center-lower region if no face detected
    if not face_locations or len(face_locations) == 0:
        # Use center-torso region (avoid edges where background appears)
        outfit_roi = img_np[int(h*0.35):int(h*0.70), int(w*0.35):int(w*0.65)]
    else:
        # Use face location to extract clothing BELOW face
        face = face_locations[0]
        
        if isinstance(face, dict):
            face_y = face.get('y', 0)
            face_h = face.get('h', 0)
            face_x = face.get('x', 0)
            face_w = face.get('w', 0)
            
            # Clothing region: IMMEDIATELY below face, narrower to avoid background
            clothing_top = min(h, face_y + face_h)
            clothing_bottom = min(h, clothing_top + int(face_h * 1.8))  # Reduced from 2.5
            clothing_left = max(0, int(face_x + face_w * 0.2))  # Narrower - avoid arms/background
            clothing_right = min(w, int(face_x + face_w * 0.8))
            
            outfit_roi = img_np[clothing_top:clothing_bottom, clothing_left:clothing_right]
        else:
            outfit_roi = img_np[int(h*0.35):int(h*0.70), int(w*0.35):int(w*0.65)]
    
    # Validate ROI
    if outfit_roi.size == 0 or outfit_roi.shape[0] < 10 or outfit_roi.shape[1] < 10:
        return [0.0] * 32  # Smaller signature
    
    # Convert to RGB
    outfit_rgb = cv2.cvtColor(outfit_roi, cv2.COLOR_BGR2RGB)
    
    # Extract 5 dominant colors using k-means
    pixels = outfit_rgb.reshape(-1, 3)
    pixels = np.float32(pixels)
    
    k = 5  # Get top 5 colors
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 200, 0.1)
    
    try:
        _, labels, centers = cv2.kmeans(pixels, k, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        
        # Count pixels per color to get percentages
        label_counts = np.bincount(labels.flatten())
        
        # Sort colors by frequency
        sorted_indices = np.argsort(label_counts)[::-1]
        dominant_colors = centers[sorted_indices]
        color_percentages = label_counts[sorted_indices] / len(labels)
        
        # Create weighted color signature (top 3 colors matter most)
        signature = []
        for i in range(min(3, k)):  # Use only top 3 colors
            color = dominant_colors[i]
            weight = color_percentages[i]
            
            # Add weighted RGB values
            signature.extend([
                color[0] * weight,
                color[1] * weight,
                color[2] * weight
            ])
        
        # Pad if needed
        while len(signature) < 9:
            signature.append(0.0)
        
        # Add color variance (detects patterns vs solid colors)
        color_variance = np.std(pixels, axis=0)
        signature.extend(color_variance.tolist())
        
        # Add brightness
        brightness = np.mean(cv2.cvtColor(outfit_roi, cv2.COLOR_BGR2GRAY))
        signature.append(brightness)
        
        # Normalize
        signature = np.array(signature)
        if np.linalg.norm(signature) > 0:
            signature = signature / np.linalg.norm(signature)
        
        return signature.tolist()
        
    except Exception as e:
        print(f"    Warning in outfit extraction: {e}")
        # Fallback: simple mean color
        mean_color = np.mean(outfit_rgb, axis=(0, 1))
        fallback = list(mean_color) + [0.0] * 10
        return fallback[:13]

def get_image_date(image_bytes):
    """Extract date from EXIF data"""
    try:
        image = Image.open(image_bytes)
        exif_data = image._getexif()
        if not exif_data:
            return None
        
        for tag_id, value in exif_data.items():
            tag_name = ExifTags.TAGS.get(tag_id)
            if tag_name == "DateTimeOriginal":
                return datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
        return None
    except Exception as e:
        return None

def cluster_faces(all_embeddings):
    """
    Cluster all face embeddings to identify unique people.
    Returns: dict mapping person_id -> list of face embedding indices
    """
    if len(all_embeddings) == 0:
        return {}
    
    # Convert to numpy array
    embeddings_array = np.array(all_embeddings)
    
    # DBSCAN clustering with STRICTER epsilon for better person separation
    clustering = DBSCAN(eps=0.35, min_samples=2, metric='cosine')  # Lowered from 0.4
    labels = clustering.fit_predict(embeddings_array)
    
    # Group by person
    person_groups = {}
    for idx, label in enumerate(labels):
        if label == -1:  # Noise/unassigned
            continue
        if label not in person_groups:
            person_groups[label] = []
        person_groups[label].append(idx)
    
    return person_groups

def find_primary_person(person_groups):
    """Find the person who appears most frequently"""
    if not person_groups:
        return None
    
    # Find person with most appearances
    primary_id = max(person_groups.keys(), key=lambda k: len(person_groups[k]))
    return primary_id

def faces_match(embedding1, embedding2, threshold=0.60):
    """Check if two face embeddings match (same person)"""
    similarity = cosine_similarity([embedding1], [embedding2])[0][0]
    return similarity > threshold

def outfit_matches(outfit1, outfit2, threshold=0.80):
    """
    Check if two outfit signatures match.
    Uses STRICTER threshold because we're now comparing precise clothing colors.
    """
    similarity = cosine_similarity([outfit1], [outfit2])[0][0]
    return similarity > threshold