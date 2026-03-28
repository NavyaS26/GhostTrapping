from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
import sqlite3, shutil, os, yagmail, asyncio
from datetime import datetime
from watermark import embed_watermark, extract_watermark
from database import init_db
from detector import detect_deepfake

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
DB_PATH = os.path.join(BASE_DIR, "ghosttrap.db")
BUILD_DIR = "C:/Users/DELL/ghosttrap/frontend/ghosttrap-ui/build"

os.makedirs(UPLOADS_DIR, exist_ok=True)

app = FastAPI()

class NgrokHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["ngrok-skip-browser-warning"] = "true"
        return response

app.add_middleware(NgrokHeaderMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# ── Active WebSocket connections ──────────────────────────────────────────────
active_connections: list[WebSocket] = []

USERS = {
    "victim@ghosttrap.com":   {"password": "victim123",   "role": "victim"},
    "predator@ghosttrap.com": {"password": "predator123", "role": "predator"},
}

# ─────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────
@app.post("/login")
async def login(data: dict):
    email = data.get("email", "")
    password = data.get("password", "")
    if email in USERS and USERS[email]["password"] == password:
        return {"role": USERS[email]["role"], "email": email}
    return {"error": "Invalid credentials"}


# ─────────────────────────────────────────────
# WebSocket — keep-alive ping so ngrok doesn't kill it
# ─────────────────────────────────────────────
@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    print(f"✅ WS connected. Total connections: {len(active_connections)}")
    try:
        # Send a ping every 20 seconds to keep the connection alive through ngrok
        async def ping():
            while True:
                await asyncio.sleep(20)
                try:
                    await websocket.send_json({"type": "PING"})
                except Exception:
                    break

        ping_task = asyncio.create_task(ping())
        try:
            while True:
                # Wait for any message from client (keep-alive ack etc.)
                await websocket.receive_text()
        finally:
            ping_task.cancel()
    except WebSocketDisconnect:
        print("WS disconnected (client left)")
    except Exception as e:
        print(f"WS error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        print(f"WS removed. Remaining connections: {len(active_connections)}")


async def broadcast(data: dict):
    print(f"📡 Broadcasting to {len(active_connections)} connections: {data['type']}")
    dead = []
    for conn in active_connections:
        try:
            await conn.send_json(data)
        except Exception as e:
            print(f"Broadcast failed for one connection: {e}")
            dead.append(conn)
    for c in dead:
        if c in active_connections:
            active_connections.remove(c)


# ─────────────────────────────────────────────
# Upload protected image (victim)
# ─────────────────────────────────────────────
@app.post("/upload-protected")
async def upload_protected(file: UploadFile = File(...), user_id: str = Form(...)):
    if not file.content_type.startswith("image/"):
        return {"error": "Only image files are accepted"}

    original_path = os.path.join(UPLOADS_DIR, f"orig_{file.filename}")
    with open(original_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    protected_path, watermark_id, secret = embed_watermark(original_path, user_id)
    protected_filename = os.path.basename(protected_path)

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO protected_content VALUES (?,?,?,?,?,?)",
        (watermark_id, file.filename, protected_filename, secret, datetime.now().isoformat(), user_id)
    )
    conn.commit()
    conn.close()

    return {"watermark_id": watermark_id, "status": "protected", "filename": protected_filename, "url": f"/uploads/{protected_filename}"}


# ─────────────────────────────────────────────
# Feed
# ─────────────────────────────────────────────
@app.get("/feed")
async def get_feed():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT watermark_id, original_filename, protected_filename, uploaded_at FROM protected_content").fetchall()
    conn.close()
    return {"feed": [{"watermark_id": r[0], "filename": r[1], "uploaded_at": r[3], "url": f"/uploads/{r[2]}"} for r in rows]}


# ─────────────────────────────────────────────
# My Posts (victim)
# ─────────────────────────────────────────────
@app.get("/my-posts")
async def my_posts(user_id: str):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("""
        SELECT pc.watermark_id, pc.original_filename, pc.protected_filename, pc.uploaded_at,
               COUNT(al.id) as breach_count
        FROM protected_content pc
        LEFT JOIN access_logs al ON al.watermark_id = pc.watermark_id
        WHERE pc.user_id = ?
        GROUP BY pc.watermark_id
        ORDER BY pc.uploaded_at DESC
    """, (user_id,)).fetchall()
    conn.close()
    return {"posts": [{"watermark_id": r[0], "filename": r[1], "uploaded_at": r[3], "breach_count": r[4], "url": f"/uploads/{r[2]}"} for r in rows]}


# ─────────────────────────────────────────────
# Fake detections log
# ─────────────────────────────────────────────
@app.get("/fake-detections")
async def fake_detections():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT filename, fake_score, real_score, uploader_ip, detected_at FROM fake_detections ORDER BY detected_at DESC").fetchall()
    conn.close()
    return {"fakes": [{"filename": r[0], "fake_score": r[1], "real_score": r[2], "uploader_ip": r[3], "detected_at": r[4]} for r in rows]}


# ─────────────────────────────────────────────
# Download (predator) — triggers DOWNLOAD alert to victim
# ─────────────────────────────────────────────
@app.post("/download")
async def download_image(data: dict, request: Request):
    real_ip = request.client.host
    user_agent = request.headers.get("user-agent", "Unknown")
    watermark_id = data.get("watermark_id")

    if not watermark_id:
        return {"error": "watermark_id required"}

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO access_logs (watermark_id, ip_address, device, browser, timestamp) VALUES (?,?,?,?,?)",
        (watermark_id, real_ip, "Unknown Device", user_agent, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()

    # Broadcast DOWNLOAD alert to victim dashboard
    await broadcast({
        "type": "DOWNLOAD",
        "watermark_id": watermark_id,
        "ip": real_ip,
        "browser": user_agent,
        "timestamp": datetime.now().isoformat(),
    })

    return {"status": "logged", "ip": real_ip}


# ─────────────────────────────────────────────
# Upload suspicious (predator) — deepfake scan
# FAKE → rejected, broadcast ALERT, auto-email
# REAL → accepted, returned with scores
# ─────────────────────────────────────────────
@app.post("/upload-suspicious")
async def upload_suspicious(file: UploadFile = File(...), request: Request = None):
    if not file.content_type.startswith("image/"):
        return {"error": "Only image files are accepted"}

    path = os.path.join(UPLOADS_DIR, f"suspicious_{file.filename}")
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    detection = detect_deepfake(path)
    uploader_ip = request.client.host if request else "Unknown"
    uploader_ua = request.headers.get("user-agent", "Unknown") if request else "Unknown"

    if detection["is_fake"]:
        watermark = extract_watermark(path)

        # Log to DB
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO fake_detections (filename, fake_score, real_score, uploader_ip, detected_at) VALUES (?,?,?,?,?)",
            (file.filename, detection["fake_score"], detection["real_score"], uploader_ip, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()

        # Delete fake image immediately
        try:
            os.remove(path)
        except Exception as e:
            print(f"Remove error: {e}")

        alert = {
            "type": "ALERT",
            "watermark_id": "UNKNOWN",
            "perpetrator_ip": uploader_ip,
            "perpetrator_browser": uploader_ua,
            "timestamp": datetime.now().isoformat(),
            "fake_score": detection["fake_score"],
            "real_score": detection["real_score"],
            "verdict": "FAKE",
            "auto_removed": True,
        }

        # Try to resolve watermark → original downloader IP
        if watermark:
            try:
                parts = watermark.split("-")
                if len(parts) >= 3:
                    watermark_id = parts[2]
                    alert["watermark_id"] = watermark_id
                    conn = sqlite3.connect(DB_PATH)
                    log = conn.execute(
                        "SELECT * FROM access_logs WHERE watermark_id=? ORDER BY timestamp DESC LIMIT 1",
                        (watermark_id,)
                    ).fetchone()
                    conn.close()
                    if log:
                        alert["perpetrator_ip"] = log[2]
                        alert["perpetrator_browser"] = log[4]
            except Exception as e:
                print(f"Watermark parse error: {e}")

        # Broadcast ALERT to victim WebSocket
        await broadcast(alert)

        # Auto-send legal notice email
        try:
            _send_legal_email(
                watermark_id=alert["watermark_id"],
                perpetrator_ip=alert["perpetrator_ip"],
                perpetrator_browser=alert["perpetrator_browser"],
                timestamp=alert["timestamp"],
                fake_score=alert["fake_score"],
            )
            print("✅ Legal email sent automatically")
        except Exception as e:
            print(f"Auto email error: {e}")

        return alert

    # REAL image — delete temp file, return scores
    try:
        os.remove(path)
    except Exception:
        pass

    return {
        "verdict": "REAL",
        "fake_score": detection["fake_score"],
        "real_score": detection["real_score"],
        "url": None,
    }


# ─────────────────────────────────────────────
# Legal notice
# ─────────────────────────────────────────────
def _build_notice(watermark_id, perpetrator_ip, perpetrator_browser, timestamp, fake_score):
    return f"""
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
Deepfake Confidence  : {fake_score}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have been identified as having downloaded, manipulated, and
re-distributed a digitally watermarked image without the owner's
consent. Our AI deepfake detection system flagged your upload
with {fake_score}% confidence as artificially manipulated content.

This constitutes:
  1. Copyright infringement
  2. Unauthorized use of personal likeness
  3. Non-consensual image manipulation

The manipulated content has been automatically removed from the
platform. This complaint has been forwarded to the Cybercrime
Investigation Department with full forensic evidence.

Issued by: GhostTrap Content Protection System
    """

def _send_legal_email(watermark_id, perpetrator_ip, perpetrator_browser, timestamp, fake_score):
    notice = _build_notice(watermark_id, perpetrator_ip, perpetrator_browser, timestamp, fake_score)
    yag = yagmail.SMTP("navyaspnk26@gmail.com", "tftdnvvkablpvmea")
    yag.send(
        to="rachfpatil@gmail.com",
        subject="⚠️ Legal Notice — GhostTrap Content Protection",
        contents=notice,
    )
    return notice

@app.post("/send-legal-notice")
async def send_legal_notice(data: dict):
    watermark_id        = data.get("watermark_id", "N/A")
    perpetrator_ip      = data.get("perpetrator_ip", "N/A")
    perpetrator_browser = data.get("perpetrator_browser", "N/A")
    timestamp           = data.get("timestamp", "N/A")
    fake_score          = data.get("fake_score", "N/A")
    notice = _build_notice(watermark_id, perpetrator_ip, perpetrator_browser, timestamp, fake_score)
    try:
        _send_legal_email(watermark_id, perpetrator_ip, perpetrator_browser, timestamp, fake_score)
        email_sent = True
    except Exception as e:
        print("Email error:", e)
        email_sent = False
    return {"notice": notice, "email_sent": email_sent}


# ─────────────────────────────────────────────
# Activity log
# ─────────────────────────────────────────────
@app.get("/activity-log")
async def get_activity_log():
    conn = sqlite3.connect(DB_PATH)
    logs = conn.execute("SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 20").fetchall()
    conn.close()
    return {"logs": logs}


# ─────────────────────────────────────────────
# Serve React frontend
# ─────────────────────────────────────────────
app.mount("/static", StaticFiles(directory=os.path.join(BUILD_DIR, "static")), name="static")

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    return FileResponse(os.path.join(BUILD_DIR, "index.html"))