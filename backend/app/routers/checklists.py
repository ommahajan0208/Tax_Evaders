"""
Checklists Router — PRD §10.5, §4.4
=====================================
Endpoints:
  POST /checklists/generate           — trigger checklist generation for a circular
  GET  /checklists/                   — list checklists
  GET  /checklists/{id}               — checklist detail with items
  PATCH /checklists/{id}/items/{iid}  — update item status / assignment
  GET  /checklists/{id}/export        — text/markdown export
"""
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database import get_db, SessionLocal
from app.models import (
    Checklist, ChecklistItem, Circular, DocumentMetadata, Obligation, User
)
from app.dependencies import get_current_user
from app.agents.checklist_generation_agent import run_checklist_generation
from app.agents.obligation_extraction_agent import run_obligation_extraction
from app.agents.audit_trail_agent import write_audit_event

router = APIRouter(prefix="/checklists", tags=["checklists"])


@router.post("/generate")
async def generate_checklist(
    circular_id: int,
    entity_type: str = "broker",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trigger checklist generation for a circular + entity type.
    If obligations don't exist yet, runs extraction first.
    """
    # 1. Verify circular exists
    circ_result = await db.execute(
        select(Circular).where(Circular.id == circular_id)
        .options(selectinload(Circular.document))
    )
    circular = circ_result.scalars().first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")

    # 2. Fetch or extract obligations
    ob_result = await db.execute(
        select(Obligation).where(Obligation.circular_id == circular_id)
    )
    obligations = ob_result.scalars().all()

    if not obligations:
        # Run extraction on the fly
        doc = circular.document
        if not doc:
            raise HTTPException(status_code=400, detail="No document attached to this circular")

        # Read stored text from vector service
        from app.services.vector_service import vector_manager
        doc_chunks = vector_manager.get_chunks_for_document(doc.filename)
        full_text = "\n".join(c.get("text", "") for c in doc_chunks) if doc_chunks else ""

        if not full_text:
            full_text = f"[Circular: {circular.title}]"

        obligations = await run_obligation_extraction(
            db,
            circular_id=circular_id,
            document_text=full_text,
            circular_name=circular.title,
        )
        await db.flush()

    # 3. Generate checklist
    checklist = await run_checklist_generation(
        db,
        circular_id=circular_id,
        circular_name=circular.title,
        entity_type=entity_type,
        obligations=list(obligations),
        org_id=getattr(current_user, "org_id", None),
    )

    await write_audit_event(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        user_name=current_user.username,
        action_type="Checklist Generated",
        action_details=f"User '{current_user.username}' generated checklist for circular_id={circular_id}, entity_type={entity_type}.",
        entity_type="Checklist",
        entity_id=str(checklist.id),
    )

    await db.commit()

    # Return with items
    await db.refresh(checklist)
    items_result = await db.execute(
        select(ChecklistItem).where(ChecklistItem.checklist_id == checklist.id)
    )
    items = items_result.scalars().all()

    return {
        "id": checklist.id,
        "name": checklist.name,
        "entity_type": checklist.entity_type,
        "circular_id": checklist.circular_id,
        "created_at": checklist.created_at,
        "items": [_item_dict(i) for i in items],
        "total_items": len(items),
        "completed_items": sum(1 for i in items if i.status == "completed"),
    }


@router.get("/")
async def list_checklists(
    circular_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all checklists, optionally filtered by circular."""
    query = select(Checklist).options(selectinload(Checklist.items))
    if circular_id:
        query = query.where(Checklist.circular_id == circular_id)
    query = query.order_by(Checklist.created_at.desc())
    result = await db.execute(query)
    checklists = result.scalars().all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "entity_type": c.entity_type,
            "circular_id": c.circular_id,
            "created_at": c.created_at,
            "total_items": len(c.items),
            "completed_items": sum(1 for i in c.items if i.status == "completed"),
            "overdue_items": sum(1 for i in c.items if i.status == "overdue"),
        }
        for c in checklists
    ]


@router.get("/{checklist_id}")
async def get_checklist(
    checklist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve checklist detail with all items."""
    result = await db.execute(
        select(Checklist)
        .where(Checklist.id == checklist_id)
        .options(
            selectinload(Checklist.items).selectinload(ChecklistItem.obligation),
            selectinload(Checklist.circular),
        )
    )
    checklist = result.scalars().first()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    items = checklist.items or []
    return {
        "id": checklist.id,
        "name": checklist.name,
        "entity_type": checklist.entity_type,
        "circular_id": checklist.circular_id,
        "circular_title": checklist.circular.title if checklist.circular else None,
        "created_at": checklist.created_at,
        "total_items": len(items),
        "completed_items": sum(1 for i in items if i.status == "completed"),
        "items": [_item_dict(i) for i in items],
    }


@router.patch("/{checklist_id}/items/{item_id}")
async def update_checklist_item(
    checklist_id: int,
    item_id: int,
    status: Optional[str] = None,
    due_date: Optional[str] = None,
    assigned_to: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a checklist item's status, due date, or assignment."""
    result = await db.execute(
        select(ChecklistItem).where(
            ChecklistItem.id == item_id,
            ChecklistItem.checklist_id == checklist_id,
        )
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    before_state = {"status": item.status, "due_date": str(item.due_date), "assigned_to": item.assigned_to}

    valid_statuses = {"not_started", "in_progress", "completed", "overdue", "not_applicable"}
    if status and status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Valid: {valid_statuses}")

    if status:
        item.status = status
    if due_date:
        from datetime import date
        item.due_date = date.fromisoformat(due_date)
    if assigned_to is not None:
        item.assigned_to = assigned_to

    after_state = {"status": item.status, "due_date": str(item.due_date), "assigned_to": item.assigned_to}

    await write_audit_event(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        user_name=current_user.username,
        action_type="Checklist Item Updated",
        action_details=f"Item {item_id} status changed to '{item.status}'.",
        entity_type="ChecklistItem",
        entity_id=str(item_id),
        before_state=before_state,
        after_state=after_state,
    )

    await db.commit()
    await db.refresh(item)
    return _item_dict(item)


@router.get("/{checklist_id}/export")
async def export_checklist(
    checklist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export checklist as a Markdown report (MVP: text-based)."""
    result = await db.execute(
        select(Checklist)
        .where(Checklist.id == checklist_id)
        .options(
            selectinload(Checklist.items).selectinload(ChecklistItem.obligation),
            selectinload(Checklist.circular),
        )
    )
    checklist = result.scalars().first()
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")

    items = checklist.items or []
    completed = sum(1 for i in items if i.status == "completed")
    lines = [
        f"# {checklist.name}",
        f"**Entity Type:** {checklist.entity_type.replace('_', ' ').title()}",
        f"**Generated:** {checklist.created_at.strftime('%Y-%m-%d')}",
        f"**Progress:** {completed}/{len(items)} items completed",
        "",
        "## Checklist Items",
        "",
        "| # | Description | Status | Due Date |",
        "|---|---|---|---|",
    ]
    for idx, item in enumerate(items, 1):
        status_icon = {
            "completed": "✅",
            "in_progress": "🔄",
            "overdue": "🔴",
            "not_applicable": "⬜",
        }.get(item.status, "⏳")
        due = str(item.due_date) if item.due_date else "—"
        desc = item.description[:80].replace("|", "\\|")
        lines.append(f"| {idx} | {desc} | {status_icon} {item.status} | {due} |")

    lines += ["", "---", "*Generated by Agentic Compliance OS — Team Tax Evaders*"]
    return {"markdown": "\n".join(lines), "checklist_name": checklist.name}


def _item_dict(item: ChecklistItem) -> dict:
    return {
        "id": item.id,
        "checklist_id": item.checklist_id,
        "obligation_id": item.obligation_id,
        "description": item.description,
        "status": item.status,
        "assigned_to": item.assigned_to,
        "due_date": str(item.due_date) if item.due_date else None,
        "evidence_url": item.evidence_url,
        "updated_at": item.updated_at,
        "section_reference": item.obligation.section_reference if item.obligation else None,
    }
