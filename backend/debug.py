import os
from dotenv import load_dotenv

load_dotenv()

# 1. Print what Python actually sees (don't worry, this runs locally only)
supa_url = os.getenv("SUPABASE_URL")
cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")

print("--- DEBUG INFO ---")
print(f"Cloudinary Name loaded: '{cloud_name}'")
print(f"Supabase URL loaded:    '{supa_url}'")

if supa_url and " " in supa_url:
    print("❌ ERROR: Your Supabase URL has a space in it!")
elif supa_url and not supa_url.startswith("https://"):
    print("❌ ERROR: Your Supabase URL is missing 'https://'")
else:
    print("✅ URL format looks correct.")