from PIL import Image, ExifTags
import numpy as np
import colorsys
from datetime import datetime

# --- CONFIGURATION ---
THUMBNAIL_SIZE = (100, 100)

def get_image_date(image: Image) -> str:
    """Extracts Date (YYYY-MM-DD) or returns 'Unsorted'."""
    try:
        exif_data = image._getexif()
        if not exif_data: return "Unsorted"
        for tag_id, value in exif_data.items():
            if ExifTags.TAGS.get(tag_id) == "DateTimeOriginal":
                try:
                    return datetime.strptime(value, "%Y:%m:%d %H:%M:%S").strftime("%Y-%m-%d")
                except: pass
        return "Unsorted"
    except: return "Unsorted"

def get_dominant_color(image: Image) -> str:
    """
    Uses a VOTING system (Histogram) to find the dominant vibrant color.
    Prevents 'mixing' colors into gray.
    """
    try:
        # 1. Resize & Convert
        img_small = image.copy()
        img_small.thumbnail(THUMBNAIL_SIZE)
        img_small = img_small.convert("RGB")
        
        # 2. Setup the Ballot Box (The Buckets)
        vote_counts = {
            "Red": 0, "Yellow": 0, "Green": 0, "Cyan": 0, "Blue": 0, "Magenta": 0,
            "White": 0, "Black": 0, "Gray": 0
        }
        
        # 3. Process Pixels
        # Iterate over every pixel and cast a vote
        pixels = list(img_small.getdata())
        
        for r, g, b in pixels:
            # Convert to HSV (Hue 0-1, Saturation 0-1, Value 0-1)
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            
            # --- RULES FOR VOTING ---
            
            # A. Is it Black/Dark?
            if v < 0.2: 
                vote_counts["Black"] += 1
                continue
                
            # B. Is it White/Bright Gray?
            if s < 0.15: # Low saturation
                if v > 0.8: vote_counts["White"] += 1
                else:       vote_counts["Gray"] += 1
                continue

            # C. It is a Color! Check the Angle (Hue)
            degree = h * 360
            
            if degree >= 330 or degree < 30:
                vote_counts["Red"] += 1
            elif 30 <= degree < 90:
                vote_counts["Yellow"] += 1
            elif 90 <= degree < 150:
                vote_counts["Green"] += 1
            elif 150 <= degree < 210:
                vote_counts["Cyan"] += 1
            elif 210 <= degree < 270:
                vote_counts["Blue"] += 1
            elif 270 <= degree < 330:
                vote_counts["Magenta"] += 1

        # 4. Count the Votes
        # We ignore Black/White/Gray unless they are the ONLY thing in the photo
        # Create a dictionary of just the colors
        vibrant_votes = {k: v for k, v in vote_counts.items() if k not in ["Black", "White", "Gray"]}
        
        if sum(vibrant_votes.values()) > 0:
            # If we found ANY color, return the winner of the colors
            winner = max(vibrant_votes, key=vibrant_votes.get)
            return winner
        else:
            # If the photo is truly black and white, return the winner of the neutrals
            neutral_votes = {k: v for k, v in vote_counts.items() if k in ["Black", "White", "Gray"]}
            return max(neutral_votes, key=neutral_votes.get)

    except Exception as e:
        print(f"Error: {e}")
        return "Unknown"