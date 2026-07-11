"""
SQLAlchemy ORM models — Agentic Compliance OS
Implements all tables from PRD Section 9 (Database Design).
This file is the package __init__.py so that 'from app.models import X' works correctly.
"""
import hashlib
import json
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey,
    Text, Date, Numeric, func, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.database import Base


class Organization(Base):
    """PRD §9.1 — Organizations table."""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    entity_type = Column(String, nullable=False, default="broker")
    sebi_registration_no = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    users = relationship("User", back_populates="organization")
    checklists = relationship("Checklist", back_populates="organization")
    risk_findings = relationship("RiskFinding", back_populates="organization")
    compliance_statuses = relationship("ComplianceStatus", back_populates="organization")
    notifications_rel = relationship("Notification", back_populates="organization")
    reports = relationship("Report", back_populates="organization")


class User(Base):
    """PRD §9.1 — Users table (extended with org + role enum)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="broker_user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)
    last_login = Column(DateTime, nullable=True)

    organization = relationship("Organization", back_populates="users")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    assigned_items = relationship("ChecklistItem", back_populates="assigned_user", foreign_keys="ChecklistItem.assigned_to")


class DocumentMetadata(Base):
    """Existing — extended to link to Circular."""
    __tablename__ = "document_metadata"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    page_count = Column(Integer, default=0, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    status = Column(String, default="pending", nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    indexed_at = Column(DateTime, nullable=True)

    rules = relationship("RegulatoryRule", back_populates="document", cascade="all, delete-orphan")
    circular = relationship("Circular", back_populates="document", uselist=False)


class Circular(Base):
    """PRD §9.1 — Circulars table. Created when a document is indexed."""
    __tablename__ = "circulars"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("document_metadata.id", ondelete="SET NULL"), nullable=True, unique=True)
    title = Column(Text, nullable=False)
    doc_type = Column(String, default="circular", nullable=False)
    issue_date = Column(Date, nullable=True)
    effective_date = Column(Date, nullable=True)
    source_url = Column(Text, nullable=True)
    file_hash = Column(String, nullable=True, index=True, unique=True)
    status = Column(String, default="active", nullable=False)
    supersedes_id = Column(Integer, ForeignKey("circulars.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    document = relationship("DocumentMetadata", back_populates="circular")
    obligations = relationship("Obligation", back_populates="circular", cascade="all, delete-orphan")
    checklists = relationship("Checklist", back_populates="circular")
    superseded_by = relationship("Circular", foreign_keys=[supersedes_id], remote_side=[id])


class RegulatoryRule(Base):
    """Existing — lightweight rule for task scheduling."""
    __tablename__ = "regulatory_rules"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("document_metadata.id", ondelete="CASCADE"), nullable=True)
    circular_name = Column(String, nullable=False)
    section_reference = Column(String, nullable=False)
    intermediary_type = Column(String, nullable=False)
    obligation_text = Column(Text, nullable=False)
    frequency = Column(String, nullable=False)
    verification_criteria = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    document = relationship("DocumentMetadata", back_populates="rules")
    tasks = relationship("ComplianceTask", back_populates="rule", cascade="all, delete-orphan")


class Obligation(Base):
    """PRD §9.1 — Obligations table. Structured, agent-extracted obligation."""
    __tablename__ = "obligations"

    id = Column(Integer, primary_key=True, index=True)
    circular_id = Column(Integer, ForeignKey("circulars.id", ondelete="CASCADE"), nullable=True)
    agent_run_id = Column(Integer, ForeignKey("agent_executions.id", ondelete="SET NULL"), nullable=True)
    obligated_entity_type = Column(String, nullable=False, default="all")
    obligation_text = Column(Text, nullable=False)
    section_reference = Column(String, nullable=True)
    deadline_type = Column(String, nullable=True)
    deadline_value = Column(Text, nullable=True)
    penalty_description = Column(Text, nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=True, default=0.8)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    circular = relationship("Circular", back_populates="obligations")
    agent_run = relationship("AgentExecution", back_populates="obligations", foreign_keys=[agent_run_id])
    checklist_items = relationship("ChecklistItem", back_populates="obligation")
    risk_findings = relationship("RiskFinding", back_populates="obligation")


class AgentExecution(Base):
    """PRD §9.1 — AgentExecutions table. Episodic memory per agent run."""
    __tablename__ = "agent_executions"

    id = Column(Integer, primary_key=True, index=True)
    trace_id = Column(String, index=True, nullable=False)
    agent_name = Column(String, nullable=False)
    input_payload = Column(Text, nullable=True)
    output_payload = Column(Text, nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=True)
    status = Column(String, default="success", nullable=False)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    obligations = relationship("Obligation", back_populates="agent_run", foreign_keys="Obligation.agent_run_id")


class Checklist(Base):
    """PRD §9.1 — Checklists table."""
    __tablename__ = "checklists"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    circular_id = Column(Integer, ForeignKey("circulars.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    entity_type = Column(String, nullable=False, default="broker")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="checklists")
    circular = relationship("Circular", back_populates="checklists")
    items = relationship("ChecklistItem", back_populates="checklist", cascade="all, delete-orphan")


class ChecklistItem(Base):
    """PRD §9.1 — ChecklistItems table with 5-state status machine."""
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("checklists.id", ondelete="CASCADE"), nullable=False)
    obligation_id = Column(Integer, ForeignKey("obligations.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=False)
    status = Column(String, default="not_started", nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_date = Column(Date, nullable=True)
    evidence_url = Column(Text, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)

    checklist = relationship("Checklist", back_populates="items")
    obligation = relationship("Obligation", back_populates="checklist_items")
    assigned_user = relationship("User", back_populates="assigned_items", foreign_keys=[assigned_to])


class ComplianceTask(Base):
    """Existing — legacy task record for evidence upload workflow."""
    __tablename__ = "compliance_tasks"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("regulatory_rules.id", ondelete="CASCADE"), nullable=False)
    assignee_department = Column(String, nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(String, default="Pending", nullable=False)
    evidence_file_path = Column(String, nullable=True)
    verification_feedback = Column(Text, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    rule = relationship("RegulatoryRule", back_populates="tasks")
    audit_logs = relationship("AuditLog", back_populates="task", cascade="all, delete-orphan")


class RiskFinding(Base):
    """PRD §9.1 — RiskFindings table: likelihood × impact scored risk."""
    __tablename__ = "risk_findings"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    obligation_id = Column(Integer, ForeignKey("obligations.id", ondelete="SET NULL"), nullable=True)
    risk_score = Column(Numeric(6, 2), nullable=False, default=0)
    likelihood = Column(Numeric(4, 2), nullable=False, default=1)
    impact = Column(Numeric(4, 2), nullable=False, default=1)
    rationale = Column(Text, nullable=True)
    status = Column(String, default="open", nullable=False)
    mitigation_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=True)

    organization = relationship("Organization", back_populates="risk_findings")
    obligation = relationship("Obligation", back_populates="risk_findings")


class ComplianceStatus(Base):
    """PRD §9.1 — Computed compliance summary per org."""
    __tablename__ = "compliance_statuses"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    overall_score = Column(Numeric(5, 2), nullable=False, default=0)
    total_items = Column(Integer, nullable=False, default=0)
    completed_items = Column(Integer, nullable=False, default=0)
    pending_actions_count = Column(Integer, nullable=False, default=0)
    overdue_count = Column(Integer, nullable=False, default=0)
    computed_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="compliance_statuses")


class Notification(Base):
    """PRD §9.1 — Notifications table for in-app alerts."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    payload = Column(Text, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="notifications")
    organization = relationship("Organization", back_populates="notifications_rel")


class Report(Base):
    """PRD §9.1 — Reports table for generated audit/compliance/risk reports."""
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    generated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    report_type = Column(String, nullable=False)
    scope_json = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    status = Column(String, default="generating", nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="reports")


class AuditLog(Base):
    """
    PRD §9.1 / §14 — AuditLogs table.
    Immutable, hash-chained log (append-only by convention).
    hash = SHA256(prev_hash + JSON(row fields))
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("compliance_tasks.id", ondelete="SET NULL"), nullable=True)
    trace_id = Column(String, index=True, nullable=True)
    actor_type = Column(String, nullable=False, default="agent")
    actor_id = Column(String, nullable=True)
    user_name = Column(String, nullable=False)
    action_type = Column(String, nullable=False)
    action_details = Column(Text, nullable=False)
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    before_state = Column(Text, nullable=True)
    after_state = Column(Text, nullable=True)
    prev_hash = Column(String, nullable=True)
    hash = Column(String, nullable=True)
    timestamp = Column(DateTime, server_default=func.now(), nullable=False)

    task = relationship("ComplianceTask", back_populates="audit_logs")

    def compute_hash(self, prev_hash: str = "") -> str:
        """SHA-256 hash over prev_hash + deterministic row serialization."""
        row_data = {
            "actor_type": self.actor_type,
            "actor_id": self.actor_id,
            "user_name": self.user_name,
            "action_type": self.action_type,
            "action_details": self.action_details,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "timestamp": str(self.timestamp),
        }
        raw = prev_hash + json.dumps(row_data, sort_keys=True)
        return hashlib.sha256(raw.encode()).hexdigest()


class ChatMessage(Base):
    """Existing — chat messages with citation JSON."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)
    confidence_score = Column(Numeric(5, 4), nullable=True)
    session_id = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="chat_messages")
