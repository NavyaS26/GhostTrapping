from stegano import lsb
from PIL import Image
import uuid

def embed_watermark(image_path: str, user_id: str):
    watermark_id = str(uuid.uuid4())[:8].upper()
    secret = f"GHOSTTRAP-{user_id}-{watermark_id}"

    img = Image.open(image_path).convert("RGB")
    temp_path = "uploads/temp_input.png"
    img.save(temp_path, format="PNG")

    marked = lsb.hide(temp_path, secret)
    output_path = f"uploads/protected_{watermark_id}.png"   # unique per upload
    marked.save(output_path, format="PNG")

    return output_path, watermark_id, secret

def extract_watermark(image_path: str):
    try:
        img = Image.open(image_path).convert("RGB")
        temp_path = "uploads/temp_scan.png"
        img.save(temp_path, format="PNG")

        hidden = lsb.reveal(temp_path)
        if hidden and "GHOSTTRAP" in hidden:
            return hidden
        return None
    except Exception as e:
        print("Extract error:", e)
        return None