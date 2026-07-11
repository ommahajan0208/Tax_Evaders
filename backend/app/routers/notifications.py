"""
Notifications Router — PRD §10 (cross-cutting), §6.2.10
=========================================================
Endpoints:
  GET  /notifications/        — list notifications for current user / org
  POST /notifications/{id}/read  — mark single notification read
  POST /notifications/read-all   — mark all read
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime

from app.database import get_db
from app.models import Notification, User
from app.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return notifications for the current user + their org."""
    query = (
        select(Notification)
        .where(
            (Notification.user_id == current_user.id) |
            (Notification.org_id == current_user.org_id)
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    if unread_only:
        query = query.where(Notification.read_at.is_(None))

    result = await db.execute(query)
    notifications = result.scalars().all()

    return [_notif_dict(n) for n in notifications]


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick count of unread notifications for badge display."""
    query = (
        select(Notification)
        .where(
            Notification.read_at.is_(None),
            (Notification.user_id == current_user.id) |
            (Notification.org_id == current_user.org_id)
        )
    )
    result = await db.execute(query)
    count = len(result.scalars().all())
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.read_at = datetime.utcnow()
    await db.commit()
    return _notif_dict(notif)


@router.post("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications for the current user as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.read_at.is_(None),
            (Notification.user_id == current_user.id) |
            (Notification.org_id == current_user.org_id)
        )
    )
    notifs = result.scalars().all()
    now = datetime.utcnow()
    for n in notifs:
        n.read_at = now
    await db.commit()
    return {"marked_read": len(notifs)}


def _notif_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "payload": n.payload,
        "read_at": n.read_at,
        "created_at": n.created_at,
    }
