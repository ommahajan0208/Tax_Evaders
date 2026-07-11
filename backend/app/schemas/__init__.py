"""
Pydantic schemas — re-exported from schemas.py via package __init__.
"""
from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional, List, Dict, Any

# --- Auth Schemas ---
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: str
    role: str
    username: str

class TokenRefresh(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Document Schemas ---
class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Rule & Compliance Task Schemas ---
class RuleResponse(BaseModel):
    id: int
    document_id: Optional[int] = None
    circular_name: str
    section_reference: str
    intermediary_type: str
    obligation_text: str
    frequency: str
    verification_criteria: str
    created_at: datetime

    class Config:
        from_attributes = True

class TaskResponse(BaseModel):
    id: int
    rule_id: int
    assignee_department: str
    due_date: date
    status: str
    evidence_file_path: Optional[str] = None
    verification_feedback: Optional[str] = None
    completed_at: Optional[datetime] = None
    rule: Optional[RuleResponse] = None

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    task_id: Optional[int] = None
    user_name: str
    action_type: str
    action_details: str
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Chat & RAG Schemas ---
class ChatQuery(BaseModel):
    question: str
    session_id: str

class SourceCitation(BaseModel):
    file: str
    page: int
    text_preview: str
    score: float

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    sources: Optional[List[SourceCitation]] = None
    confidence_score: Optional[float] = None
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Admin Schemas ---
class UserRoleUpdate(BaseModel):
    role: str

class SystemStats(BaseModel):
    total_documents: int
    total_chunks: int
    total_users: int
    total_queries: int
    faiss_health: str
    last_rebuild: Optional[str] = None
