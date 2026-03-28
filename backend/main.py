from fastapi import FastAPI, UploadFile, File, WebSocket, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import sqlite3, shutil, os, yagmail
from datetime import datetime
from watermark import embed_watermark, extract_watermark
from database import init_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

active_connections = []

# Hardcoded users for demo
USERS = {
    "victim@ghosttrap.com":   {"password": "victim123",   "role": "victim"},
    "predator@ghosttrap.com": {"password": "predator123", "role": "predator"}
}

@app.post("/login")
async def login(data: dict):
    email = data.get("email")
    password = data.get("password")
    if email in USERS and USERS[email]["password"] == password:
        return {"role": USERS[email]["role"], "email": email}
    return {"error": "Invalid credentials"}

@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        active_connections.remove(websocket)

async def broadcast_alert(alert_data: dict):
    for connection in active_connections:
        await connection.send_json(alert_data)

@app.post("/upload-protected")
async def upload_protected(
    file: UploadFile = File(...),
    user_id: str = Form(...)
):
    path = f"uploads/{file.filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    protected_path, watermark_id, secret = embed_watermark(path, user_id)

    conn = sqlite3.connect("ghosttrap.db")
    conn.execute(
        "INSERT OR REPLACE INTO protected_content VALUES (?,?,?,?)",
        (watermark_id, file.filename, secret, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()

    return {"watermark_id": watermark_id, "status": "protected",
            "filename": "protected_output.png"}

@app.get("/feed")
async def get_feed():
    conn = sqlite3.connect("ghosttrap.db")
    content = conn.execute(
        "SELECT watermark_id, filename, uploaded_at FROM protected_content"
    ).fetchall()
    conn.close()
    items = []
    for row in content:
        items.append({
            "watermark_id": row[0],
            "filename": row[1],
            "uploaded_at": row[2],
            "url": f"/uploads/protected_output.png"
        })
    return {"feed": items}

@app.post("/download")
async def download_image(data: dict, request: Request):
    real_ip = request.client.host
    user_agent = request.headers.get("user-agent", "Unknown")

    conn = sqlite3.connect("ghosttrap.db")
    conn.execute(
        "INSERT INTO access_logs (watermark_id, ip_address, device, browser, timestamp) VALUES (?,?,?,?,?)",
        (data["watermark_id"], real_ip, "Unknown Device", user_agent, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()

    # Broadcast download activity to victim dashboard
    await broadcast_alert({
        "type": "DOWNLOAD",
        "watermark_id": data["watermark_id"],
        "ip": real_ip,
        "browser": user_agent,
        "timestamp": datetime.now().isoformat()
    })

    return {"status": "logged", "ip": real_ip}

@app.post("/upload-suspicious")
async def upload_suspicious(file: UploadFile = File(...), request: Request = None):
    path = f"uploads/suspicious_{file.filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    watermark = extract_watermark(path)

    if watermark:
        parts = watermark.split("-")
        watermark_id = parts[2]

        conn = sqlite3.connect("ghosttrap.db")
        log = conn.execute(
            "SELECT * FROM access_logs WHERE watermark_id=? ORDER BY timestamp DESC LIMIT 1",
            (watermark_id,)
        ).fetchone()
        conn.close()

        if log:
            alert = {
                "type": "ALERT",
                "watermark_id": watermark_id,
                "perpetrator_ip": log[2],
                "perpetrator_browser": log[4],
                "timestamp": log[5],
                "suspicious_image": f"suspicious_{file.filename}"
            }
            await broadcast_alert(alert)
            return alert

    return {"watermark_found": False}

@app.post("/send-legal-notice")
async def send_legal_notice(data: dict):
    predator_email = "rachfpatil@gmail.com"
    watermark_id = data.get("watermark_id")
    perpetrator_ip = data.get("perpetrator_ip")
    perpetrator_browser = data.get("perpetrator_browser")
    timestamp = data.get("timestamp")

    notice = f"""
LEGAL NOTICE — UNAUTHORIZED USE OF COPYRIGHTED IMAGE

Date: {datetime.now().strftime("%B %d, %Y")}
Reference: GT-{watermark_id}-{datetime.now().strftime("%Y%m%d")}

TO WHOM IT MAY CONCERN,

This notice is issued regarding unauthorized use and manipulation 
of a digitally protected image.

VIOLATION DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Protected Content ID : {watermark_id}
Violation Detected   : {timestamp}
Offender IP Address  : {perpetrator_ip}
Offender System      : {perpetrator_browser}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have been identified as having downloaded, manipulated, and 
re-distributed a digitally watermarked image without the owner's 
consent. This constitutes:

  1. Copyright infringement
  2. Unauthorized use of personal likeness  
  3. Non-consensual image manipulation

This complaint has been forwarded to the Cybercrime Investigation 
Department with full forensic evidence.

Issued by: GhostTrap Content Protection System
    """

    try:
        yag = yagmail.SMTP("navyaspnk26@gmail.com", "tftdnvvkablpvmea")
        yag.send(
            to=predator_email,
            subject="⚠️ Legal Notice — GhostTrap Content Protection",
            contents=notice
        )
        email_sent = True
    except Exception as e:
        print("Email error:", e)
        email_sent = False

    return {"notice": notice, "email_sent": email_sent}

@app.get("/activity-log")
async def get_activity_log():
    conn = sqlite3.connect("ghosttrap.db")
    logs = conn.execute(
        "SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return {"logs": logs}