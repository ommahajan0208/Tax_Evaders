"""
Regulatory Change Monitoring Agent — PRD §6.2.7
=================================================
On new document ingestion, diffs the incoming circular's obligations
against existing obligations for the same entity type.
Emits Notification rows for affected users/orgs.
"""
import json
import uuid
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import AgentExecution, Notification, Obligation


async def run_change_monitoring(
    db: AsyncSession,
    *,
    circular_id: int,
    circular_name: str,
    new_obligations: List[Obligation],
    org_id: Optional[int] = None,
    trace_id: Optional[str] = None,
) -> List[dict]:
    """
    Compare new_obligations against existing obligations for overlap.
    Emit 'change_detected' notifications when related sections are found.

    Returns a list of change event dicts:
      {affected_obligation_id, change_type, diff_summary}
    """
    trace_id = trace_id or str(uuid.uuid4())
    change_events = []

    # Fetch existing obligations from other circulars
    existing_result = await db.execute(
        select(Obligation).where(
            Obligation.circular_id != circular_id
        ).limit(500)
    )
    existing_obligations: List[Obligation] = existing_result.scalars().all()

    if not existing_obligations:
        return []

    # Simple semantic overlap: check section reference or keyword overlap
    for new_ob in new_obligations:
        new_text_keywords = set(_keywords(new_ob.obligation_text))
        new_section = (new_ob.section_reference or "").lower()

        for ex_ob in existing_obligations:
            ex_keywords = set(_keywords(ex_ob.obligation_text))
            ex_section = (ex_ob.section_reference or "").lower()

            keyword_overlap = len(new_text_keywords & ex_keywords)
            section_match = (
                new_section and ex_section and
                (new_section in ex_section or ex_section in new_section)
            )

            if keyword_overlap >= 5 or section_match:
                diff_summary = (
                    f"New circular '{circular_name}' may affect obligation "
                    f"'{ex_ob.section_reference}'. "
                    f"Keyword overlap: {keyword_overlap} terms."
                )

                change_event = {
                    "affected_obligation_id": ex_ob.id,
                    "change_type": "potential_amendment",
                    "diff_summary": diff_summary,
                }
                change_events.append(change_event)

                # Create in-app notification
                notif = Notification(
                    org_id=org_id,
                    type="change_detected",
                    title=f"⚠️ Regulatory Change Detected — {new_section or circular_name}",
                    body=diff_summary,
                    payload=json.dumps(change_event),
                )
                db.add(notif)

    if change_events:
        exec_record = AgentExecution(
            trace_id=trace_id,
            agent_name="ChangeMonitoringAgent",
            input_payload=json.dumps({
                "circular_id": circular_id,
                "new_obligations": len(new_obligations),
                "existing_obligations_checked": len(existing_obligations),
            }),
            output_payload=json.dumps({"change_events": len(change_events)}),
            confidence_score=0.75,
            status="success",
        )
        db.add(exec_record)
        await db.flush()

    return change_events


def _keywords(text: str) -> List[str]:
    """Extract meaningful lowercase keywords from obligation text."""
    stopwords = {
        "the", "a", "an", "is", "are", "to", "of", "in", "and", "or",
        "shall", "must", "will", "be", "by", "for", "with", "from", "that",
        "this", "its", "on", "at", "as", "any", "all",
    }
    import re
    words = re.findall(r"[a-z]+", text.lower())
    return [w for w in words if w not in stopwords and len(w) > 3]
