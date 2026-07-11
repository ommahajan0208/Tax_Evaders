"""
Obligation Extraction Agent — PRD §6.2.2
==========================================
Parses structured obligation records from document chunks using Gemini.
Outputs: {obligated_party, obligation_text, deadline, penalty, section_reference, confidence}
Persists results to the Obligation table.
"""
import json
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentExecution, Obligation
from app.services.gemini import extract_obligations_structured


async def run_obligation_extraction(
    db: AsyncSession,
    *,
    circular_id: int,
    document_text: str,
    circular_name: str,
    trace_id: Optional[str] = None,
) -> List[Obligation]:
    """
    Run the obligation extraction agent for a given circular.
    Returns the list of persisted Obligation ORM objects.
    """
    trace_id = trace_id or str(uuid.uuid4())
    start_ms = int(time.time() * 1000)

    # 1. Call the LLM extraction function
    extracted = extract_obligations_structured(circular_name, document_text)

    duration_ms = int(time.time() * 1000) - start_ms

    # Compute aggregate confidence
    if extracted:
        avg_conf = sum(r.get("confidence", 0.8) for r in extracted) / len(extracted)
    else:
        avg_conf = 0.0

    # 2. Record agent execution
    exec_record = AgentExecution(
        trace_id=trace_id,
        agent_name="ObligationExtractionAgent",
        input_payload=json.dumps({"circular_id": circular_id, "circular_name": circular_name}),
        output_payload=json.dumps(extracted),
        confidence_score=round(avg_conf, 4),
        status="success" if extracted else "escalated",
        duration_ms=duration_ms,
    )
    db.add(exec_record)
    await db.flush()

    # 3. Persist obligations
    obligations = []
    for item in extracted:
        ob = Obligation(
            circular_id=circular_id,
            agent_run_id=exec_record.id,
            obligated_entity_type=item.get("obligated_entity_type", "all"),
            obligation_text=item.get("obligation_text", ""),
            section_reference=item.get("section_reference"),
            deadline_type=item.get("deadline_type"),
            deadline_value=json.dumps(item.get("deadline_value")) if item.get("deadline_value") else None,
            penalty_description=item.get("penalty_description"),
            confidence_score=round(item.get("confidence", 0.8), 4),
        )
        db.add(ob)
        obligations.append(ob)

    await db.flush()
    return obligations
