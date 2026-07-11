"""
Circulars Router — PRD §10.7, §4.7
=====================================
Endpoints:
  GET /circulars/          — list all circulars
  GET /circulars/recent    — recent circulars with optional filters
  GET /circulars/{id}      — circular detail
  GET /circulars/{id}/changes  — affected obligations diff
  GET /circulars/{id}/obligations — obligations extracted from circular
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Circular, Obligation, User
from app.dependencies import get_current_user

router = APIRouter(prefix="/circulars", tags=["circulars"])


@router.get("/")
async def list_circulars(
    doc_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all circulars, optionally filtered."""
    query = select(Circular).order_by(Circular.created_at.desc()).limit(limit)
    if doc_type:
        query = query.where(Circular.doc_type == doc_type)
    if status:
        query = query.where(Circular.status == status)

    result = await db.execute(query)
    circulars = result.scalars().all()
    return [_circular_dict(c) for c in circulars]


@router.get("/recent")
async def recent_circulars(
    since: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return recently ingested circulars.
    Optionally filter by entity_type via obligations.
    """
    query = (
        select(Circular)
        .options(selectinload(Circular.obligations))
        .order_by(Circular.created_at.desc())
        .limit(limit)
    )

    if since:
        from datetime import date
        try:
            since_date = date.fromisoformat(since)
            query = query.where(Circular.created_at >= since_date)
        except ValueError:
            pass

    result = await db.execute(query)
    circulars = result.scalars().all()

    # Filter by entity_type if provided
    if entity_type:
        circulars = [
            c for c in circulars
            if any(
                ob.obligated_entity_type in ("all", entity_type)
                for ob in c.obligations
            )
        ]

    return [_circular_dict(c) for c in circulars]


@router.get("/{circular_id}")
async def get_circular(
    circular_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return circular detail."""
    result = await db.execute(
        select(Circular)
        .where(Circular.id == circular_id)
        .options(selectinload(Circular.obligations))
    )
    circular = result.scalars().first()
    if not circular:
        raise HTTPException(status_code=404, detail="Circular not found")

    d = _circular_dict(circular)
    d["obligation_count"] = len(circular.obligations)
    return d


@router.get("/{circular_id}/changes")
async def get_circular_changes(
    circular_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a diff of obligations in this circular vs pre-existing obligations.
    Used by Change Monitoring Agent for display.
    """
    # Get obligations for this circular
    new_result = await db.execute(
        select(Obligation).where(Obligation.circular_id == circular_id)
    )
    new_obs = new_result.scalars().all()

    # Get obligations from other circulars
    existing_result = await db.execute(
        select(Obligation).where(Obligation.circular_id != circular_id).limit(200)
    )
    existing_obs = existing_result.scalars().all()

    changes = []
    for new_ob in new_obs:
        new_kws = set(_keywords(new_ob.obligation_text))
        for ex_ob in existing_obs:
            ex_kws = set(_keywords(ex_ob.obligation_text))
            overlap = len(new_kws & ex_kws)
            if overlap >= 5:
                changes.append({
                    "new_obligation_id": new_ob.id,
                    "existing_obligation_id": ex_ob.id,
                    "new_section": new_ob.section_reference,
                    "existing_section": ex_ob.section_reference,
                    "overlap_score": overlap,
                    "change_type": "potential_amendment",
                    "diff_summary": f"{overlap} shared keywords detected between obligations.",
                })

    return {
        "circular_id": circular_id,
        "new_obligations_count": len(new_obs),
        "affected_existing_count": len(set(c["existing_obligation_id"] for c in changes)),
        "changes": changes[:50],
    }


@router.get("/{circular_id}/obligations")
async def get_circular_obligations(
    circular_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all obligations extracted from a circular."""
    result = await db.execute(
        select(Obligation).where(Obligation.circular_id == circular_id)
        .order_by(Obligation.id.asc())
    )
    obligations = result.scalars().all()
    return [
        {
            "id": ob.id,
            "obligated_entity_type": ob.obligated_entity_type,
            "obligation_text": ob.obligation_text,
            "section_reference": ob.section_reference,
            "deadline_type": ob.deadline_type,
            "deadline_value": ob.deadline_value,
            "penalty_description": ob.penalty_description,
            "confidence_score": float(ob.confidence_score or 0),
        }
        for ob in obligations
    ]


def _circular_dict(c: Circular) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "doc_type": c.doc_type,
        "status": c.status,
        "issue_date": str(c.issue_date) if c.issue_date else None,
        "effective_date": str(c.effective_date) if c.effective_date else None,
        "source_url": c.source_url,
        "created_at": c.created_at,
    }


def _keywords(text: str):
    import re
    stopwords = {"the", "a", "an", "is", "are", "to", "of", "in", "and", "or", "shall", "must"}
    return [w for w in re.findall(r"[a-z]+", text.lower()) if w not in stopwords and len(w) > 3]
