import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, date, timedelta
from typing import List
from app.database import get_db, SessionLocal
from app.models import DocumentMetadata, RegulatoryRule, ComplianceTask, AuditLog
from app.schemas import DocumentResponse
from app.config import settings
from app.dependencies import get_current_user
from app.services.pdf_parser import extract_pdf_pages
from app.services.chunk_service import chunk_document_pages
from app.services.vector_service import vector_manager
from app.services.gemini import extract_regulatory_rules

router = APIRouter(prefix="/documents", tags=["documents"])

# Helper to schedule compliance tasks based on extracted rules
async def schedule_tasks_for_rule(rule: RegulatoryRule, db: AsyncSession):
    today = date.today()
    freq = rule.frequency.strip().lower()
    
    # Map department assignees by section reference keywords or default to Compliance
    sect_ref = rule.section_reference.lower()
    obligation = rule.obligation_text.lower()
    
    if "reconciliation" in obligation or "fund" in obligation or "finance" in sect_ref:
        dept = "Finance"
    elif "security" in obligation or "cyber" in obligation or "system" in sect_ref or "it" in sect_ref:
        dept = "IT"
    elif "operation" in obligation or "client account" in obligation or "trade" in obligation:
        dept = "Operations"
    else:
        dept = "Compliance"
        
    due_dates = []
    
    if "daily" in freq:
        due_dates.append(today)  # due today
    elif "weekly" in freq:
        due_dates.append(today + timedelta(days=(6 - today.weekday())))  # due Sunday
    elif "monthly" in freq:
        # Next month start minus 1 day
        next_month = today.replace(day=28) + timedelta(days=4)
        due_dates.append(next_month - timedelta(days=next_month.day))
    elif "quarterly" in freq:
        # Simple quarter calculator
        month = today.month
        if month <= 3:
            q_end = date(today.year, 3, 31)
        elif month <= 6:
            q_end = date(today.year, 6, 30)
        elif month <= 9:
            q_end = date(today.year, 9, 30)
        else:
            q_end = date(today.year, 12, 31)
        due_dates.append(q_end)
    elif "annually" in freq:
        due_dates.append(date(today.year, 12, 31))
    else:
        # Default/Event-based: 15 days from now
        due_dates.append(today + timedelta(days=15))
        
    for due in due_dates:
        task = ComplianceTask(
            rule_id=rule.id,
            assignee_department=dept,
            due_date=due,
            status="Pending"
        )
        db.add(task)


# Background task for indexing
async def process_document_background(doc_id: int, file_path: str, filename: str):
    # Open separate session for background thread operations
    async with SessionLocal() as db:
        try:
            # 1. Fetch document record
            result = await db.execute(select(DocumentMetadata).where(DocumentMetadata.id == doc_id))
            doc = result.scalars().first()
            if not doc:
                return
                
            doc.status = "processing"
            await db.commit()
            
            # 2. Parse text
            pages = extract_pdf_pages(file_path)
            doc.page_count = len(pages)
            await db.commit()
            
            # 3. Create chunks and index to FAISS
            chunks = chunk_document_pages(pages, filename)
            doc.chunk_count = len(chunks)
            vector_manager.add_chunks(chunks)
            await db.commit()
            
            # 4. Agentic Rule Extraction
            full_text = "\n".join([p["text"] for p in pages])
            rules = extract_regulatory_rules(filename, full_text)
            
            # Save rules and tasks
            for rule_data in rules:
                rule = RegulatoryRule(
                    document_id=doc.id,
                    circular_name=filename,
                    section_reference=rule_data.get("section_reference", "General"),
                    intermediary_type=rule_data.get("intermediary_type", "Stockbroker"),
                    obligation_text=rule_data.get("obligation_text", ""),
                    frequency=rule_data.get("frequency", "Daily"),
                    verification_criteria=rule_data.get("verification_criteria", "")
                )
                db.add(rule)
                await db.flush()  # Populates rule.id
                
                await schedule_tasks_for_rule(rule, db)
                
            # Log action
            audit_log = AuditLog(
                task_id=None,
                user_name="System Agent",
                action_type="Rule Extraction",
                action_details=f"Extracted {len(rules)} rules from regulatory document '{filename}'."
            )
            db.add(audit_log)
            
            # Mark indexing done
            doc.status = "indexed"
            doc.indexed_at = datetime.utcnow()
            await db.commit()
            
        except Exception as e:
            # Rollback and save failure reason
            await db.rollback()
            result = await db.execute(select(DocumentMetadata).where(DocumentMetadata.id == doc_id))
            doc = result.scalars().first()
            if doc:
                doc.status = "failed"
                doc.error_message = str(e)
                await db.commit()
            print(f"Background parsing failed for document {doc_id}: {str(e)}")


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported."
        )
        
    filename = file.filename
    unique_filename = f"{int(datetime.utcnow().timestamp())}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)
    
    # Save the file
    content = await file.read()
    file_size = len(content)
    with open(file_path, "wb") as f:
        f.write(content)
        
    # Record metadata
    doc_metadata = DocumentMetadata(
        filename=unique_filename,
        original_name=filename,
        file_size=file_size,
        page_count=0,
        chunk_count=0,
        status="pending"
    )
    db.add(doc_metadata)
    await db.commit()
    await db.refresh(doc_metadata)
    
    # Dispatch processing to background worker thread
    background_tasks.add_task(process_document_background, doc_metadata.id, file_path, unique_filename)
    
    return doc_metadata


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(DocumentMetadata).order_by(DocumentMetadata.created_at.desc()))
    return result.scalars().all()


@router.get("/{id}/status")
async def get_document_status(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(DocumentMetadata).where(DocumentMetadata.id == id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "id": doc.id,
        "status": doc.status,
        "page_count": doc.page_count,
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message
    }


@router.delete("/{id}")
async def delete_document(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(select(DocumentMetadata).where(DocumentMetadata.id == id))
    doc = result.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    # Delete chunks from Vector Store
    vector_manager.delete_document_chunks(doc.filename)
    
    # Delete physical file
    file_path = os.path.join(settings.UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
            
    # Cascade deletes DB rules & tasks
    await db.delete(doc)
    await db.commit()
    
    return {"detail": "Document and indexing resources deleted successfully"}
