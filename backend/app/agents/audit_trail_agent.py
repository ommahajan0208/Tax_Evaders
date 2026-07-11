"""
Audit Trail Agent — PRD §6.2.9, §14
=====================================
Write-ahead, append-only, SHA-256 hash-chained audit log writer.
Called BEFORE any mutation is marked complete.
"""
import hashlib
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import AuditLog


async def write_audit_event(
    db: AsyncSession,
    *,
    actor_type: str = "agent",
    actor_id: Optional[str] = None,
    user_name: str = "System Agent",
    action_type: str,
    action_details: str,
    trace_id: Optional[str] = None,
    task_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    before_state: Optional[dict] = None,
    after_state: Optional[dict] = None,
) -> AuditLog:
    """
    Create an immutable audit log entry with hash-chaining.
    hash = SHA256(prev_hash + deterministic_row_json)
    """
    # Fetch the most recent audit log to get prev_hash
    prev_log_result = await db.execute(
        select(AuditLog).order_by(AuditLog.id.desc()).limit(1)
    )
    prev_log = prev_log_result.scalars().first()
    prev_hash = prev_log.hash if (prev_log and prev_log.hash) else ""

    now = datetime.utcnow()

    # Build deterministic row representation
    row_data = {
        "actor_type": actor_type,
        "actor_id": actor_id or "",
        "user_name": user_name,
        "action_type": action_type,
        "action_details": action_details,
        "entity_type": entity_type or "",
        "entity_id": entity_id or "",
        "timestamp": now.isoformat(),
    }
    raw = prev_hash + json.dumps(row_data, sort_keys=True)
    current_hash = hashlib.sha256(raw.encode()).hexdigest()

    log = AuditLog(
        task_id=task_id,
        trace_id=trace_id,
        actor_type=actor_type,
        actor_id=actor_id,
        user_name=user_name,
        action_type=action_type,
        action_details=action_details,
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=json.dumps(before_state) if before_state else None,
        after_state=json.dumps(after_state) if after_state else None,
        prev_hash=prev_hash,
        hash=current_hash,
        timestamp=now,
    )
    db.add(log)
    await db.flush()   # Ensure ID is populated before returning
    return log
