import os
import json
import sqlite3
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import BASE_DIR, SOURCES, EXAM_CATEGORIES, EXAM_TARGETS
from app.database import get_db_connection, init_db
from app.models import (
    ArticleItem, BookmarkCreate, BookmarkUpdate,
    NoteCreate, NoteUpdate, QuizSubmitRequest
)
from app.scrapers.engine import sync_all_sources, populate_starter_data, get_last_sync_info
from app.services.quiz_gen import generate_mcqs_from_articles

app = FastAPI(
    title="Live Current Affairs - SSC, Railways & Banking",
    description="Exam-Oriented Live Current Affairs Portal with GKToday, Drishti IAS, The Hindu, ET, & Study Notepad",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# App startup: initialize database and populate starter facts
@app.on_event("startup")
def on_startup():
    init_db()
    populate_starter_data()
    # Trigger an initial live sync in the background or right away
    try:
        sync_all_sources()
    except Exception as e:
        print(f"[Startup] Initial sync notice: {e}")

# Static file serving
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Live Current Affairs API is Running. Frontend index.html not found yet."}

# ==================== LIVE SYNC & STATUS ====================

@app.get("/api/status")
def get_status():
    sync_info = get_last_sync_info()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM articles")
    total_articles = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as total FROM bookmarks")
    total_saved = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as total FROM notes")
    total_notes = cursor.fetchone()["total"]
    conn.close()
    
    return {
        "status": "online",
        "last_sync": sync_info.get("last_synced_at"),
        "total_articles": total_articles,
        "total_saved": total_saved,
        "total_notes": total_notes,
        "sources": SOURCES,
        "exam_categories": EXAM_CATEGORIES,
        "exam_targets": EXAM_TARGETS
    }

@app.post("/api/sync")
def trigger_sync(background_tasks: BackgroundTasks):
    """Triggers real-time live scrape from all sources."""
    res = sync_all_sources()
    return {"message": "Sync completed successfully", "details": res}

# ==================== ARTICLES & FEED ====================

@app.get("/api/articles")
def get_articles(
    exam_target: Optional[str] = Query(None, description="all, ssc, railway, banking"),
    category: Optional[str] = Query(None, description="Category filter"),
    source: Optional[str] = Query(None, description="Source ID e.g. gktoday"),
    search: Optional[str] = Query(None, description="Search keyword"),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    limit: int = 50,
    offset: int = 0
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM articles WHERE 1=1"
    params = []
    
    if exam_target and exam_target != "all":
        query += " AND exam_targets LIKE ?"
        params.append(f'%"{exam_target}"%')
        
    if category and category != "All Categories":
        query += " AND category = ?"
        params.append(category)
        
    if source and source != "all":
        query += " AND source_id = ?"
        params.append(source)
        
    if search:
        query += " AND (title LIKE ? OR bullets LIKE ? OR one_liner LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])
        
    if date:
        query += " AND published_date = ?"
        params.append(date)
        
    query += " ORDER BY is_featured DESC, created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    # Get user bookmarks to mark is_saved
    cursor.execute("SELECT article_id, user_notes FROM bookmarks")
    saved_map = {r["article_id"]: r["user_notes"] for r in cursor.fetchall()}
    
    articles = []
    for r in rows:
        art_id = r["id"]
        articles.append({
            "id": art_id,
            "title": r["title"],
            "source_id": r["source_id"],
            "source_name": r["source_name"],
            "original_url": r["original_url"],
            "published_date": r["published_date"],
            "category": r["category"],
            "exam_targets": json.loads(r["exam_targets"]) if r["exam_targets"] else [],
            "bullets": json.loads(r["bullets"]) if r["bullets"] else [],
            "one_liner": r["one_liner"],
            "static_gk": json.loads(r["static_gk"]) if r["static_gk"] else [],
            "is_featured": bool(r["is_featured"]),
            "is_saved": art_id in saved_map,
            "user_note": saved_map.get(art_id, "")
        })
        
    conn.close()
    return {"articles": articles, "total": len(articles)}

@app.get("/api/one-liners")
def get_one_liners(
    exam_target: Optional[str] = Query(None),
    limit: int = 30
):
    """Returns crisp 1-liner ticker points for fast 5-minute revision."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, title, one_liner, category, source_name, exam_targets, published_date FROM articles WHERE 1=1"
    params = []
    
    if exam_target and exam_target != "all":
        query += " AND exam_targets LIKE ?"
        params.append(f'%"{exam_target}"%')
        
    query += " ORDER BY is_featured DESC, created_at DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "title": r["title"],
            "one_liner": r["one_liner"],
            "category": r["category"],
            "source_name": r["source_name"],
            "exam_targets": json.loads(r["exam_targets"]) if r["exam_targets"] else [],
            "published_date": r["published_date"]
        })
    conn.close()
    return {"one_liners": items}

# ==================== BOOKMARKS / REVISION DECK ====================

@app.get("/api/bookmarks")
def get_bookmarks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT b.*, a.original_url, a.one_liner 
    FROM bookmarks b
    LEFT JOIN articles a ON b.article_id = a.id
    ORDER BY b.saved_at DESC
    """)
    rows = cursor.fetchall()
    
    bookmarks = []
    for r in rows:
        bookmarks.append({
            "id": r["id"],
            "article_id": r["article_id"],
            "title": r["title"],
            "category": r["category"],
            "source_name": r["source_name"],
            "bullets": json.loads(r["bullets"]) if r["bullets"] else [],
            "static_gk": json.loads(r["static_gk"]) if r["static_gk"] else [],
            "user_notes": r["user_notes"] or "",
            "exam_targets": json.loads(r["exam_targets"]) if r["exam_targets"] else [],
            "original_url": r["original_url"],
            "one_liner": r["one_liner"],
            "saved_at": r["saved_at"]
        })
    conn.close()
    return {"bookmarks": bookmarks, "total": len(bookmarks)}

@app.post("/api/bookmarks")
def save_bookmark(data: BookmarkCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check article exists
    cursor.execute("SELECT * FROM articles WHERE id = ?", (data.article_id,))
    art = cursor.fetchone()
    if not art:
        conn.close()
        raise HTTPException(status_code=404, detail="Article not found")
        
    try:
        cursor.execute("""
        INSERT INTO bookmarks (article_id, title, category, source_name, bullets, static_gk, user_notes, exam_targets)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(article_id) DO UPDATE SET
            user_notes = excluded.user_notes
        """, (
            art["id"],
            art["title"],
            art["category"],
            art["source_name"],
            art["bullets"],
            art["static_gk"],
            data.user_notes or "",
            art["exam_targets"]
        ))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
        
    conn.close()
    return {"status": "saved", "article_id": data.article_id}

@app.delete("/api/bookmarks/{article_id}")
def delete_bookmark(article_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bookmarks WHERE article_id = ?", (article_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "article_id": article_id}

# ==================== INTERACTIVE NOTEPAD ====================

@app.get("/api/notes")
def get_notes():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notes ORDER BY is_pinned DESC, updated_at DESC")
    rows = cursor.fetchall()
    
    notes = []
    for r in rows:
        notes.append({
            "id": r["id"],
            "title": r["title"],
            "content": r["content"],
            "tags": json.loads(r["tags"]) if r["tags"] else [],
            "color": r["color"] or "indigo",
            "is_pinned": bool(r["is_pinned"]),
            "updated_at": r["updated_at"],
            "created_at": r["created_at"]
        })
    conn.close()
    return {"notes": notes}

@app.post("/api/notes")
def create_note(data: NoteCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
    INSERT INTO notes (title, content, tags, color, is_pinned, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        data.title or "Untitled Note",
        data.content,
        json.dumps(data.tags or []),
        data.color or "indigo",
        1 if data.is_pinned else 0,
        now,
        now
    ))
    note_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "created", "note_id": note_id}

@app.put("/api/notes/{note_id}")
def update_note(note_id: int, data: NoteUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    updates = []
    params = []
    
    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title)
    if data.content is not None:
        updates.append("content = ?")
        params.append(data.content)
    if data.tags is not None:
        updates.append("tags = ?")
        params.append(json.dumps(data.tags))
    if data.color is not None:
        updates.append("color = ?")
        params.append(data.color)
    if data.is_pinned is not None:
        updates.append("is_pinned = ?")
        params.append(1 if data.is_pinned else 0)
        
    updates.append("updated_at = ?")
    params.append(now)
    params.append(note_id)
    
    cursor.execute(f"UPDATE notes SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return {"status": "updated", "note_id": note_id}

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted", "note_id": note_id}

# ==================== DAILY QUIZ / PRACTICE MCQs ====================

@app.get("/api/quiz/today")
def get_daily_quiz(limit: int = 10):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM articles ORDER BY is_featured DESC, created_at DESC LIMIT 25")
    rows = cursor.fetchall()
    
    raw_articles = []
    for r in rows:
        raw_articles.append({
            "id": r["id"],
            "title": r["title"],
            "source_name": r["source_name"],
            "category": r["category"],
            "exam_targets": json.loads(r["exam_targets"]) if r["exam_targets"] else [],
            "bullets": json.loads(r["bullets"]) if r["bullets"] else [],
            "static_gk": json.loads(r["static_gk"]) if r["static_gk"] else []
        })
    conn.close()
    
    mcqs = generate_mcqs_from_articles(raw_articles, count=limit)
    return {"questions": mcqs, "total": len(mcqs)}

@app.post("/api/quiz/submit")
def submit_quiz(req: QuizSubmitRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO quiz_history (date, score, total_questions, details)
    VALUES (?, ?, ?, ?)
    """, (
        req.date or datetime.now().strftime("%Y-%m-%d"),
        req.score,
        req.total_questions,
        json.dumps(req.answers)
    ))
    conn.commit()
    conn.close()
    return {"status": "recorded", "score": req.score, "total": req.total_questions}

@app.get("/api/quiz/history")
def get_quiz_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quiz_history ORDER BY created_at DESC LIMIT 10")
    rows = cursor.fetchall()
    history = [dict(r) for r in rows]
    conn.close()
    return {"history": history}
