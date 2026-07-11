"""
Reports Router — PRD §10.9, §11.6, §14.4
==========================================
Endpoints:
  POST /reports/generate       — async report generation
  GET  /reports/               — list reports
  GET  /reports/{id}           — report detail
  GET  /reports/{id}/download  — download report content
"""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db, SessionLocal
from app.models import Report, RiskFinding, Checklist, ChecklistItem, AuditLog, User
from app.dependencies import get_current_user
from app.services.gemini import generate_report_narrative

router = APIRouter(prefix="/reports", tags=["reports"])


async def _generate_report_background(report_id: int, report_type: str, scope_json: str):
    """Background task: build report content and update record."""
    async with SessionLocal() as db:
        try:
            result = await db.execute(select(Report).where(Report.id == report_id))
            report = result.scalars().first()
            if not report:
                return

            scope = json.loads(scope_json) if scope_json else {}

            # Gather data summary
            data_lines = []

            # Checklists summary
            cl_result = await db.execute(
                select(Checklist).options(selectinload(Checklist.items))
            )
            checklists = cl_result.scalars().all()
            total_items = sum(len(c.items) for c in checklists)
            completed_items = sum(
                sum(1 for i in c.items if i.status == "completed") for c in checklists
            )
            data_lines.append(f"Total checklists: {len(checklists)}")
            data_lines.append(f"Total checklist items: {total_items}")
            data_lines.append(f"Completed items: {completed_items}")
            if total_items > 0:
                pct = round(completed_items / total_items * 100, 1)
                data_lines.append(f"Compliance rate: {pct}%")

            # Risk findings summary
            rf_result = await db.execute(select(RiskFinding))
            findings = rf_result.scalars().all()
            data_lines.append(f"Total risk findings: {len(findings)}")
            data_lines.append(f"Open findings: {sum(1 for f in findings if f.status == 'open')}")
            data_lines.append(
                f"High risk findings (score ≥ 16): {sum(1 for f in findings if float(f.risk_score or 0) >= 16)}"
            )

            scope_summary = (
                f"Report Type: {report_type}. "
                f"Date range: {scope.get('date_range', 'All time')}."
            )
            data_summary = "\n".join(data_lines)

            content = generate_report_narrative(
                report_type=report_type,
                scope_summary=scope_summary,
                data_summary=data_summary,
            )

            report.content = content
            report.status = "ready"
            await db.commit()

        except Exception as e:
            result2 = await db.execute(select(Report).where(Report.id == report_id))
            rep = result2.scalars().first()
            if rep:
                rep.status = "failed"
                rep.content = f"Report generation failed: {str(e)}"
                await db.commit()


@router.post("/generate")
async def generate_report(
    background_tasks: BackgroundTasks,
    report_type: str = "compliance_summary",
    date_range: Optional[str] = None,
    circular_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger async report generation."""
    valid_types = {"audit", "compliance_summary", "risk"}
    if report_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid report_type. Valid: {valid_types}")

    scope = {}
    if date_range:
        scope["date_range"] = date_range
    if circular_id:
        scope["circular_id"] = circular_id

    report = Report(
        org_id=current_user.org_id,
        generated_by=current_user.id,
        report_type=report_type,
        scope_json=json.dumps(scope),
        status="generating",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    background_tasks.add_task(
        _generate_report_background, report.id, report_type, json.dumps(scope)
    )

    return {
        "report_id": report.id,
        "status": "generating",
        "message": "Report is being generated. Poll GET /reports/{id} for status.",
    }


@router.get("/")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all generated reports."""
    result = await db.execute(
        select(Report).order_by(Report.created_at.desc()).limit(50)
    )
    reports = result.scalars().all()
    return [_report_dict(r) for r in reports]


@router.get("/{report_id}")
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get report status and content."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _report_dict(report, include_content=True)


@router.get("/{report_id}/download")
async def download_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download report as Markdown content (MVP — no binary file)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalars().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "ready":
        raise HTTPException(status_code=425, detail=f"Report not ready. Current status: {report.status}")

    from fastapi.responses import PlainTextResponse
    filename = f"compliance_report_{report_id}_{report.report_type}.md"
    return PlainTextResponse(
        content=report.content or "No content available.",
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _report_dict(r: Report, include_content: bool = False) -> dict:
    d = {
        "id": r.id,
        "report_type": r.report_type,
        "status": r.status,
        "org_id": r.org_id,
        "generated_by": r.generated_by,
        "scope": json.loads(r.scope_json) if r.scope_json else {},
        "created_at": r.created_at,
    }
    if include_content:
        d["content"] = r.content
    return d
