import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from app.database import get_db, SessionLocal
from app.models import ChatMessage, AuditLog
from app.schemas import ChatQuery, ChatMessageResponse, SourceCitation
from app.dependencies import get_current_user
from app.services.vector_service import vector_manager
from app.services.gemini import generate_chat_response_stream

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/")
async def submit_chat_query(
    query: ChatQuery,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    question = query.question
    session_id = query.session_id
    
    # 1. Fetch relevant chunks from FAISS
    chunks = vector_manager.search(question, top_k=5)
    
    # Map vector search results to SourceCitations
    sources = []
    for c in chunks:
        # Generate a confidence metric derived from FAISS cosine similarity score
        # Since flat index Inner Product on normalized vectors is between -1 and 1
        # typically positive for matches, we bind it between 0.0 and 1.0
        confidence = max(0.0, min(1.0, c["score"]))
        sources.append({
            "file": c["filename"],
            "page": c["page_number"],
            "text_preview": c["text"][:300],
            "score": confidence
        })
        
    # 2. Get past chat history for context
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
    )
    history_messages = history_result.scalars().all()
    history_data = [{"role": msg.role, "content": msg.content} for msg in history_messages]
    
    # 3. Stream Response Generator
    async def event_generator():
        # First send the sources metadata so client knows grounding citations immediately
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        
        full_response = ""
        # Stream response tokens
        for token in generate_chat_response_stream(question, sources, history_data):
            full_response += token
            yield f"event: token\ndata: {json.dumps(token)}\n\n"
            
        # Write user query and AI response to DB once streaming finishes successfully
        async with SessionLocal() as db_session:
            user_msg = ChatMessage(
                user_id=current_user.id,
                role="user",
                content=question,
                session_id=session_id
            )
            ai_msg = ChatMessage(
                user_id=current_user.id,
                role="assistant",
                content=full_response,
                sources=json.dumps(sources),
                session_id=session_id
            )
            db_session.add(user_msg)
            db_session.add(ai_msg)
            
            # Log action to audit trails
            log = AuditLog(
                task_id=None,
                user_name=current_user.username,
                action_type="Conversational Chat",
                action_details=f"User asked: '{question[:50]}...'. Answer grounded with {len(sources)} citations."
            )
            db_session.add(log)
            await db_session.commit()
            
        yield "event: done\ndata: {}\n\n"
        
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/history", response_model=List[ChatMessageResponse])
async def get_chat_history(
    session_id: str = Query(..., description="The chat session ID"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    
    response_data = []
    for msg in messages:
        sources_list = None
        if msg.sources:
            try:
                sources_list = json.loads(msg.sources)
            except Exception:
                pass
                
        response_data.append(ChatMessageResponse(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            sources=sources_list,
            session_id=msg.session_id,
            created_at=msg.created_at
        ))
        
    return response_data


@router.delete("/history")
async def clear_chat_history(
    session_id: str = Query(..., description="The chat session ID to delete"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Retrieve messages
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
    )
    messages = result.scalars().all()
    for msg in messages:
        await db.delete(msg)
    await db.commit()
    return {"detail": f"Chat history for session '{session_id}' cleared successfully."}


@router.get("/sessions")
async def list_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Lists all unique sessions created by the current user."""
    # SQLite / PostgreSQL group_by session_id
    result = await db.execute(
        select(ChatMessage.session_id)
        .where(ChatMessage.user_id == current_user.id)
        .group_by(ChatMessage.session_id)
        .order_by(ChatMessage.created_at.desc())
    )
    sessions = result.scalars().all()
    return {"sessions": sessions}
