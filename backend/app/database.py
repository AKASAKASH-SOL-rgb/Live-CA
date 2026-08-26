import sqlite3
import json
from datetime import datetime
from app.config import DB_PATH

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Table for aggregated current affairs articles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_name TEXT NOT NULL,
        original_url TEXT,
        published_date TEXT NOT NULL,
        category TEXT NOT NULL,
        exam_targets TEXT NOT NULL, -- JSON array of 'ssc', 'railway', 'banking'
        bullets TEXT NOT NULL,      -- JSON array of 2-3 linear bullet points
        one_liner TEXT NOT NULL,    -- Crisp 1-line exam takeaway
        static_gk TEXT,             -- JSON object/array of Static GK booster facts
        summary_raw TEXT,
        is_featured INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table for saved/bookmarked facts (My Revision Deck)
    # Stored independently so bookmarks never disappear
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        source_name TEXT NOT NULL,
        bullets TEXT NOT NULL,
        static_gk TEXT,
        user_notes TEXT,
        exam_targets TEXT,
        original_url TEXT,
        one_liner TEXT,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Ensure existing database columns exist (automatic migration)
    try:
        cursor.execute("ALTER TABLE bookmarks ADD COLUMN original_url TEXT;")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE bookmarks ADD COLUMN one_liner TEXT;")
    except Exception:
        pass


    # Table for interactive Notepad custom notes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        color TEXT DEFAULT 'indigo',
        is_pinned INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table for Quiz Scores & Daily Progress
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()
