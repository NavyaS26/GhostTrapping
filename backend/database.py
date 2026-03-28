import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ghosttrap.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS protected_content (
            watermark_id       TEXT PRIMARY KEY,
            original_filename  TEXT,
            protected_filename TEXT,
            secret             TEXT,
            uploaded_at        TEXT,
            user_id            TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS access_logs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            watermark_id TEXT,
            ip_address   TEXT,
            device       TEXT,
            browser      TEXT,
            timestamp    TEXT
        )
    """)

    # Stores every fake image that was detected and auto-removed
    conn.execute("""
        CREATE TABLE IF NOT EXISTS fake_detections (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT,
            fake_score  REAL,
            real_score  REAL,
            uploader_ip TEXT,
            detected_at TEXT
        )
    """)

    conn.commit()
    conn.close()

init_db()