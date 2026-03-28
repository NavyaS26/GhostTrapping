from stegano import lsb
from PIL import Image

# Create a simple test image
img = Image.new("RGB", (500, 500), color=(100, 150, 200))
img.save("test.png")

# Embed watermark
secret = "GHOSTTRAP-USER001-ABC12345"
marked = lsb.hide("test.png", secret)
marked.save("test_marked.png")

# Extract watermark
revealed = lsb.reveal("test_marked.png")
print("Extracted watermark:", revealed)