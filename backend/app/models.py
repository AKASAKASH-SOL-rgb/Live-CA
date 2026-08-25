from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class StaticGKItem(BaseModel):
    label: str
    value: str

class ArticleItem(BaseModel):
    id: str
    title: str
    source_id: str
    source_name: str
    original_url: Optional[str] = None
    published_date: str
    category: str
    exam_targets: List[str]
    bullets: List[str]
    one_liner: str
    static_gk: Optional[List[StaticGKItem]] = None
    is_featured: bool = False
    is_saved: Optional[bool] = False
    user_note: Optional[str] = None

class BookmarkCreate(BaseModel):
    article_id: str
    user_notes: Optional[str] = ""

class BookmarkUpdate(BaseModel):
    user_notes: str

class NoteCreate(BaseModel):
    title: str
    content: str
    tags: Optional[List[str]] = []
    color: Optional[str] = "indigo"
    is_pinned: Optional[bool] = False

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None

class QuizQuestion(BaseModel):
    id: str
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    category: str
    exam_target: str
    source_article_id: Optional[str] = None

class QuizSubmitRequest(BaseModel):
    date: str
    score: int
    total_questions: int
    answers: List[Dict[str, Any]]
