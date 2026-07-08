from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date, func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)  # "admin" or "user"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_login = Column(DateTime, nullable=True)

    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")


class DocumentMetadata(Base):
    __tablename__ = "document_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, default=0, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    status = Column(String, default="pending", nullable=False)  # "pending", "processing", "indexed", "failed"
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    indexed_at = Column(DateTime, nullable=True)

    rules = relationship("RegulatoryRule", back_populates="document", cascade="all, delete-orphan")


class RegulatoryRule(Base):
    __tablename__ = "regulatory_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("document_metadata.id", ondelete="CASCADE"), nullable=True)
    circular_name = Column(String, nullable=False)
    section_reference = Column(String, nullable=False)
    intermediary_type = Column(String, nullable=False)  # "Stockbroker", "Investment Adviser", etc.
    obligation_text = Column(Text, nullable=False)
    frequency = Column(String, nullable=False)  # "Daily", "Quarterly", "Annually", etc.
    verification_criteria = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    document = relationship("DocumentMetadata", back_populates="rules")
    tasks = relationship("ComplianceTask", back_populates="rule", cascade="all, delete-orphan")


class ComplianceTask(Base):
    __tablename__ = "compliance_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("regulatory_rules.id", ondelete="CASCADE"), nullable=False)
    assignee_department = Column(String, nullable=False)  # "Operations", "Finance", "Compliance", "IT"
    due_date = Column(Date, nullable=False)
    status = Column(String, default="Pending", nullable=False)  # "Pending", "Under Review", "Compliant", "Non-Compliant", "Overdue"
    evidence_file_path = Column(String, nullable=True)
    verification_feedback = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    rule = relationship("RegulatoryRule", back_populates="tasks")
    audit_logs = relationship("AuditLog", back_populates="task", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("compliance_tasks.id", ondelete="CASCADE"), nullable=True)
    user_name = Column(String, nullable=False)
    action_type = Column(String, nullable=False)  # "Upload Evidence", "System Extraction", "Agent Verification", "Rebuild FAISS"
    action_details = Column(Text, nullable=False)
    timestamp = Column(DateTime, server_default=func.now(), nullable=False)

    task = relationship("ComplianceTask", back_populates="audit_logs")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON-serialized array of source citations
    session_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="chat_messages")
