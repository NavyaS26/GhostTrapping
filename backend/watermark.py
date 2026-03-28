from stegano import lsb
from PIL import Image
import uuid, os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

def embed_watermark(image_path: str, user_id: str):
    watermark_id = str(uuid.uuid4())[:8].upper()
    secret = f"GHOSTTRAP-{user_id}-{watermark_id}"

    img = Image.open(image_path).convert("RGB")
    temp_path = os.path.join(UPLOADS_DIR, "temp_input.png")
    img.save(temp_path, format="PNG")

    marked = lsb.hide(temp_path, secret)
    output_path = os.path.join(UPLOADS_DIR, f"protected_{watermark_id}.png")
    marked.save(output_path, format="PNG")

    return output_path, watermark_id, secret

def extract_watermark(image_path: str):
    try:
        img = Image.open(image_path).convert("RGB")
        temp_path = os.path.join(UPLOADS_DIR, "temp_scan.png")
        img.save(temp_path, format="PNG")

        hidden = lsb.reveal(temp_path)
        if hidden and "GHOSTTRAP" in hidden:
            return hidden
        return None
    except Exception as e:
        print("Extract error:", e)
        return None