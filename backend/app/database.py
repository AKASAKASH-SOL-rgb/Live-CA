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
        static_gk TEXT,             -- JSON object/array of Static GK booster facts (HQ, Year, Chairman, etc.)
        summary_raw TEXT,
        is_featured INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table for saved/bookmarked facts (My Revision Deck)
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
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
    );
    """)

    # Table for interactive Notepad custom notes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT, -- JSON array of tags e.g. ["Banking", "SSC", "August 2026"]
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
        details TEXT, -- JSON string of quiz questions and answers
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()
