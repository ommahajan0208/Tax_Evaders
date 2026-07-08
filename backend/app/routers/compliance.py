import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import List, Optional
from app.database import get_db
from app.models import RegulatoryRule, ComplianceTask, AuditLog
from app.schemas import RuleResponse, TaskResponse, AuditLogResponse
from app.dependencies import get_current_user
from app.config import settings
from app.services.pdf_parser import extract_pdf_pages
from app.services.gemini import verify_compliance_evidence

router = APIRouter(prefix="/compliance", tags=["compliance"])

@router.get("/rules", response_model=List[RuleResponse])
async def list_rules(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(RegulatoryRule).order_by(RegulatoryRule.created_at.desc()))
    return result.scalars().all()


@router.get("/tasks", response_model=List[TaskResponse])
async def list_tasks(
    department: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = select(ComplianceTask).options(selectinload(ComplianceTask.rule))
    
    if department:
        query = query.where(ComplianceTask.assignee_department == department)
    if status:
        query = query.where(ComplianceTask.status == status)
        
    query = query.order_by(ComplianceTask.due_date.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/tasks/{id}/verify")
async def verify_task_evidence(
    id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Fetch compliance task and join rule criteria
    task_result = await db.execute(
        select(ComplianceTask)
        .where(ComplianceTask.id == id)
        .options(selectinload(ComplianceTask.rule))
    )
    task = task_result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Compliance task not found")
        
    rule = task.rule
    if not rule:
        raise HTTPException(status_code=400, detail="Associated rule not found for this task")
        
    # 2. Save evidence file to disk
    filename = file.filename
    unique_filename = f"evidence_{task.id}_{int(datetime.utcnow().timestamp())}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
        
    # 3. Extract text content from the uploaded evidence
    evidence_text = ""
    if filename.endswith(".pdf"):
        try:
            pages = extract_pdf_pages(file_path)
            evidence_text = "\n".join([p["text"] for p in pages])
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Could not parse uploaded PDF evidence: {str(e)}"
            )
    else:
        # Try text decoding
        try:
            evidence_text = content.decode("utf-8", errors="ignore")
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Supported files are PDF or plain text/csv files."
            )
            
    # 4. Trigger Agentic Evidence Verifier
    task.status = "Under Review"
    await db.commit()
    
    # Run verifier agent
    verification_res = verify_compliance_evidence(
        criteria=rule.verification_criteria,
        evidence_text=evidence_text
    )
    
    is_compliant = verification_res.get("is_compliant", False)
    feedback = verification_res.get("feedback", "No feedback provided by the agent.")
    anomalies = verification_res.get("anomalies", "None")
    
    # 5. Update task state
    task.status = "Compliant" if is_compliant else "Non-Compliant"
    task.evidence_file_path = unique_filename
    task.verification_feedback = f"Feedback: {feedback}\nAnomalies Detected: {anomalies}"
    
    if is_compliant:
        task.completed_at = datetime.utcnow()
    else:
        task.completed_at = None
        
    # 6. Log to Audit Trail
    audit = AuditLog(
        task_id=task.id,
        user_name=current_user.username,
        action_type="Evidence Verification",
        action_details=(
            f"Evidence file '{filename}' verified against criteria. "
            f"Result: {task.status}. Anomalies: {anomalies}"
        )
    )
    db.add(audit)
    await db.commit()
    await db.refresh(task)
    
    return {
        "task_id": task.id,
        "status": task.status,
        "is_compliant": is_compliant,
        "feedback": feedback,
        "anomalies": anomalies,
        "completed_at": task.completed_at
    }


@router.get("/audit", response_model=List[AuditLogResponse])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()))
    return result.scalars().all()
