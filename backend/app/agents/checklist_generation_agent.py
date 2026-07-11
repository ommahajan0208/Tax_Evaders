"""
Checklist Generation Agent — PRD §6.2.3, §12
=============================================
Converts a set of Obligation objects into a named Checklist + ChecklistItems.
Entity-type aware; splits compound obligations into atomic items.
"""
import json
import time
import uuid
from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentExecution, Checklist, ChecklistItem, Obligation


# ---------------------------------------------------------------------------
# Deadline → due_date mapping helper
# ---------------------------------------------------------------------------

def _compute_due_date(deadline_type: Optional[str], deadline_value: Optional[str]) -> Optional[date]:
    today = date.today()
    if not deadline_type:
        return today + timedelta(days=30)

    dtype = deadline_type.lower()
    if "fixed" in dtype and deadline_value:
        try:
            # deadline_value may be ISO date string
            val = json.loads(deadline_value) if deadline_value.startswith("{") else deadline_value
            return date.fromisoformat(str(val))
        except Exception:
            pass
    if "recurring" in dtype or "daily" in dtype:
        return today
    if "weekly" in dtype:
        return today + timedelta(days=(6 - today.weekday()))
    if "monthly" in dtype:
        return (today.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    if "quarterly" in dtype:
        month = today.month
        if month <= 3:
            return date(today.year, 3, 31)
        elif month <= 6:
            return date(today.year, 6, 30)
        elif month <= 9:
            return date(today.year, 9, 30)
        else:
            return date(today.year, 12, 31)
    if "annual" in dtype:
        return date(today.year, 12, 31)
    # event_triggered or unknown
    return today + timedelta(days=15)


async def run_checklist_generation(
    db: AsyncSession,
    *,
    circular_id: int,
    circular_name: str,
    entity_type: str,
    obligations: List[Obligation],
    org_id: Optional[int] = None,
    trace_id: Optional[str] = None,
) -> Checklist:
    """
    Generate a Checklist and ChecklistItems from a list of Obligation objects.
    """
    trace_id = trace_id or str(uuid.uuid4())
    start_ms = int(time.time() * 1000)

    # Build checklist name
    checklist_name = f"{circular_name} — {entity_type.replace('_', ' ').title()} Checklist"

    checklist = Checklist(
        org_id=org_id,
        circular_id=circular_id,
        name=checklist_name,
        entity_type=entity_type,
    )
    db.add(checklist)
    await db.flush()  # Populate checklist.id

    items = []
    for ob in obligations:
        # Filter by entity type relevance
        ob_entity = (ob.obligated_entity_type or "all").lower()
        entity_lower = entity_type.lower()
        if ob_entity not in ("all", entity_lower, "both") and entity_lower not in ob_entity:
            continue

        # Split compound obligations: sentences with "," or ";" separating distinct actions
        segments = _split_obligation(ob.obligation_text)

        for seg in segments:
            if len(seg.strip()) < 15:   # Skip noise fragments
                continue
            due = _compute_due_date(ob.deadline_type, ob.deadline_value)
            item = ChecklistItem(
                checklist_id=checklist.id,
                obligation_id=ob.id,
                description=seg.strip(),
                status="not_started",
                due_date=due,
            )
            db.add(item)
            items.append(item)

    await db.flush()

    duration_ms = int(time.time() * 1000) - start_ms

    exec_record = AgentExecution(
        trace_id=trace_id,
        agent_name="ChecklistGenerationAgent",
        input_payload=json.dumps({
            "circular_id": circular_id,
            "entity_type": entity_type,
            "obligation_count": len(obligations),
        }),
        output_payload=json.dumps({
            "checklist_id": checklist.id,
            "item_count": len(items),
        }),
        confidence_score=0.9,
        status="success",
        duration_ms=duration_ms,
    )
    db.add(exec_record)
    await db.flush()

    return checklist


def _split_obligation(text: str) -> List[str]:
    """
    Split a compound obligation into atomic action items.
    Heuristic: split on 'and', ';', or numbered sub-clauses.
    """
    import re
    # Try splitting on semicolons first (most reliable delimiter in legal text)
    if ";" in text:
        return [s.strip() for s in text.split(";") if s.strip()]
    # Try splitting on explicit numbered lists like (a), (b) or 1. 2.
    parts = re.split(r"\s*\(\w\)\s*|\s*\d+\.\s+", text)
    if len(parts) > 1:
        return [p.strip() for p in parts if p.strip()]
    # Return as single item
    return [text.strip()]
