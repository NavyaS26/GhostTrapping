import torch
from transformers import AutoImageProcessor, SiglipForImageClassification
from PIL import Image

device = "cuda" if torch.cuda.is_available() else "cpu"
model_name = "prithivMLmods/deepfake-detector-model-v1"

print("Loading deepfake detection model...")
model = SiglipForImageClassification.from_pretrained(model_name)
processor = AutoImageProcessor.from_pretrained(model_name)
model.to(device)
model.eval()
print("Model loaded!")

def detect_deepfake(image_path: str) -> dict:
    try:
        image = Image.open(image_path).convert("RGB")
        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)[0]

        fake_score = float(probs[0])
        real_score = float(probs[1])
        is_fake = fake_score > real_score

        return {
            "is_fake": is_fake,
            "fake_score": round(fake_score * 100, 2),
            "real_score": round(real_score * 100, 2),
            "verdict": "FAKE" if is_fake else "REAL"
        }
    except Exception as e:
        print(f"Detection error: {e}")
        return {"is_fake": False, "fake_score": 0, "real_score": 100, "verdict": "ERROR"}