import sqlite3

def init_db():
    conn = sqlite3.connect("ghosttrap.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS protected_content (
            watermark_id       TEXT PRIMARY KEY,
            original_filename  TEXT,
            protected_filename TEXT,       -- actual saved file in /uploads/
            secret             TEXT,
            uploaded_at        TEXT,
            user_id            TEXT        -- who uploaded it (victim email)
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
    conn.commit()
    conn.close()

init_db()