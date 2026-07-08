from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import User, DocumentMetadata, ChatMessage, AuditLog
from app.schemas import UserResponse, UserRoleUpdate, SystemStats
from app.dependencies import get_admin_user
from app.services.vector_service import vector_manager
from app.services.pdf_parser import extract_pdf_pages
from app.services.chunk_service import chunk_document_pages
import os
from app.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin_user = Depends(get_admin_user)
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/users/{id}/role", response_model=UserResponse)
async def update_user_role(
    id: int,
    role_update: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user = Depends(get_admin_user)
):
    result = await db.execute(select(User).where(User.id == id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    role = role_update.role.strip().lower()
    if role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'admin' or 'user'.")
        
    user.role = role
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/stats", response_model=SystemStats)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    admin_user = Depends(get_admin_user)
):
    # 1. Total documents
    doc_count_res = await db.execute(select(func.count(DocumentMetadata.id)))
    doc_count = doc_count_res.scalar() or 0
    
    # 2. Total chunks
    chunk_count_res = await db.execute(select(func.sum(DocumentMetadata.chunk_count)))
    chunk_count = chunk_count_res.scalar() or 0
    
    # 3. Total users
    user_count_res = await db.execute(select(func.count(User.id)))
    user_count = user_count_res.scalar() or 0
    
    # 4. Total queries
    query_count_res = await db.execute(
        select(func.count(ChatMessage.id)).where(ChatMessage.role == "user")
    )
    query_count = query_count_res.scalar() or 0
    
    # FAISS Health check
    faiss_status = "Healthy"
    if vector_manager.index is None:
        faiss_status = "Error (Index Unloaded)"
        
    # Get last index build timestamp from metadata
    last_rebuild = "N/A"
    if vector_manager.metadata:
        # Get latest timestamp from first chunk's metadata if present
        try:
            ts = vector_manager.metadata[0].get("timestamp")
            if ts:
                last_rebuild = str(func.datetime(ts, 'unixepoch'))  # simple conversion
        except Exception:
            pass
            
    return SystemStats(
        total_documents=doc_count,
        total_chunks=chunk_count,
        total_users=user_count,
        total_queries=query_count,
        faiss_health=faiss_status,
        last_rebuild=last_rebuild
    )


@router.post("/reindex")
async def rebuild_vector_index(
    db: AsyncSession = Depends(get_db),
    admin_user = Depends(get_admin_user)
):
    """
    Clears the FAISS index and completely rebuilds it by parsing all currently
    successful documents stored on the server's disk.
    """
    # 1. Wipe FAISS
    vector_manager.rebuild_index()
    
    # 2. Retrieve all documents that were previously indexed
    result = await db.execute(select(DocumentMetadata).where(DocumentMetadata.status == "indexed"))
    documents = result.scalars().all()
    
    reindexed_count = 0
    for doc in documents:
        file_path = os.path.join(settings.UPLOAD_DIR, doc.filename)
        if not os.path.exists(file_path):
            doc.status = "failed"
            doc.error_message = "Physical source file missing from server upload store."
            continue
            
        try:
            pages = extract_pdf_pages(file_path)
            chunks = chunk_document_pages(pages, doc.filename)
            vector_manager.add_chunks(chunks)
            
            doc.page_count = len(pages)
            doc.chunk_count = len(chunks)
            reindexed_count += 1
        except Exception as e:
            doc.status = "failed"
            doc.error_message = f"Re-indexing parsing error: {str(e)}"
            
    # Log re-indexing action
    log = AuditLog(
        task_id=None,
        user_name=admin_user.username,
        action_type="Rebuild Vector DB",
        action_details=f"Triggered FAISS index rebuild. Successfully processed {reindexed_count} documents."
    )
    db.add(log)
    await db.commit()
    
    return {
        "detail": f"Vector DB rebuild completed. {reindexed_count} documents re-indexed successfully."
    }
