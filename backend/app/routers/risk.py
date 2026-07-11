"""
Risk Router — PRD §10.6, §4.5, §13
=====================================
Endpoints:
  GET  /risk/findings        — list ranked risk findings
  POST /risk/findings/{id}/mitigate — mark a finding mitigated
  GET  /risk/summary         — aggregate risk stats for dashboard
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.database import get_db
from app.models import RiskFinding, Obligation, User
from app.dependencies import get_current_user
from app.agents.audit_trail_agent import write_audit_event

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/findings")
async def list_risk_findings(
    status: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return ranked risk findings sorted by score descending."""
    query = (
        select(RiskFinding)
        .options(selectinload(RiskFinding.obligation))
        .order_by(RiskFinding.risk_score.desc())
        .limit(limit)
    )
    if status:
        query = query.where(RiskFinding.status == status)

    result = await db.execute(query)
    findings = result.scalars().all()

    if entity_type:
        findings = [
            f for f in findings
            if f.obligation and (
                f.obligation.obligated_entity_type in ("all", entity_type) or
                entity_type in (f.obligation.obligated_entity_type or "")
            )
        ]

    return [_finding_dict(f) for f in findings]


@router.get("/summary")
async def risk_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate risk stats for the risk dashboard heatmap."""
    result = await db.execute(
        select(RiskFinding).options(selectinload(RiskFinding.obligation))
    )
    findings = result.scalars().all()

    # Build heatmap: 5×5 grid counts
    heatmap = {}
    for f in findings:
        L = int(round(float(f.likelihood or 1)))
        I = int(round(float(f.impact or 1)))
        key = f"{L},{I}"
        heatmap[key] = heatmap.get(key, 0) + 1

    # Build heatmap as list of {likelihood, impact, count}
    heatmap_list = [
        {"likelihood": int(k.split(",")[0]), "impact": int(k.split(",")[1]), "count": v}
        for k, v in heatmap.items()
    ]

    open_count = sum(1 for f in findings if f.status == "open")
    high_risk_count = sum(1 for f in findings if float(f.risk_score or 0) >= 16)
    mitigated_count = sum(1 for f in findings if f.status == "mitigated")

    return {
        "total_findings": len(findings),
        "open": open_count,
        "high_risk": high_risk_count,
        "mitigated": mitigated_count,
        "accepted": sum(1 for f in findings if f.status == "accepted"),
        "average_score": (
            round(sum(float(f.risk_score or 0) for f in findings) / len(findings), 2)
            if findings else 0
        ),
        "heatmap": heatmap_list,
    }


@router.post("/findings/{finding_id}/mitigate")
async def mitigate_finding(
    finding_id: int,
    mitigation_notes: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a risk finding as mitigated with notes."""
    result = await db.execute(
        select(RiskFinding).where(RiskFinding.id == finding_id)
    )
    finding = result.scalars().first()
    if not finding:
        raise HTTPException(status_code=404, detail="Risk finding not found")

    before_state = {"status": finding.status}
    finding.status = "mitigated"
    finding.mitigation_notes = mitigation_notes

    await write_audit_event(
        db,
        actor_type="user",
        actor_id=str(current_user.id),
        user_name=current_user.username,
        action_type="Risk Finding Mitigated",
        action_details=f"Finding {finding_id} marked mitigated. Notes: {mitigation_notes[:200]}",
        entity_type="RiskFinding",
        entity_id=str(finding_id),
        before_state=before_state,
        after_state={"status": "mitigated"},
    )

    await db.commit()
    await db.refresh(finding)
    return _finding_dict(finding)


@router.post("/findings/{finding_id}/accept")
async def accept_finding(
    finding_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a risk finding (acknowledge but don't mitigate)."""
    result = await db.execute(
        select(RiskFinding).where(RiskFinding.id == finding_id)
    )
    finding = result.scalars().first()
    if not finding:
        raise HTTPException(status_code=404, detail="Risk finding not found")

    finding.status = "accepted"
    await db.commit()
    return _finding_dict(finding)


def _finding_dict(f: RiskFinding) -> dict:
    return {
        "id": f.id,
        "org_id": f.org_id,
        "obligation_id": f.obligation_id,
        "risk_score": float(f.risk_score or 0),
        "likelihood": float(f.likelihood or 1),
        "impact": float(f.impact or 1),
        "rationale": f.rationale,
        "status": f.status,
        "mitigation_notes": f.mitigation_notes,
        "created_at": f.created_at,
        "obligation_text": f.obligation.obligation_text[:200] if f.obligation else None,
        "section_reference": f.obligation.section_reference if f.obligation else None,
        "entity_type": f.obligation.obligated_entity_type if f.obligation else None,
    }
