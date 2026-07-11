"""
Orchestrator — PRD §6.1, §6.4
================================
Directed-graph state machine coordinating all specialized agents.
States: RETRIEVING → EXTRACTING → GENERATING → REVIEWING → FINALIZED

Called from the document ingestion pipeline after a document is indexed.
"""
import json
import uuid
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.audit_trail_agent import write_audit_event
from app.agents.obligation_extraction_agent import run_obligation_extraction
from app.agents.checklist_generation_agent import run_checklist_generation
from app.agents.risk_analysis_agent import run_risk_analysis
from app.agents.change_monitoring_agent import run_change_monitoring
from app.models import AgentExecution, Circular, Notification


# ---------------------------------------------------------------------------
# State machine states
# ---------------------------------------------------------------------------
class OrchestratorState:
    IDLE = "IDLE"
    EXTRACTING = "EXTRACTING"
    GENERATING = "GENERATING"
    RISK_SCORING = "RISK_SCORING"
    CHANGE_MONITORING = "CHANGE_MONITORING"
    REVIEWING = "REVIEWING"
    FINALIZED = "FINALIZED"
    FAILED = "FAILED"


async def run_ingestion_pipeline(
    db: AsyncSession,
    *,
    circular_id: int,
    circular_name: str,
    document_text: str,
    entity_type: str = "broker",
    org_id: Optional[int] = None,
    confidence_threshold: float = 0.75,
) -> Dict[str, Any]:
    """
    Full agent orchestration pipeline triggered after document indexing.

    Pipeline:
      1. ObligationExtractionAgent  (EXTRACTING)
      2. ChecklistGenerationAgent   (GENERATING)
      3. RiskAnalysisAgent          (RISK_SCORING)
      4. ChangeMonitoringAgent      (CHANGE_MONITORING)
      5. AuditTrailAgent            (logs each step)
      6. FINALIZED / FAILED
    """
    trace_id = str(uuid.uuid4())
    state = OrchestratorState.IDLE
    result: Dict[str, Any] = {
        "trace_id": trace_id,
        "circular_id": circular_id,
        "obligations": [],
        "checklist_id": None,
        "risk_findings": [],
        "change_events": [],
        "state": state,
        "errors": [],
    }

    # ---- Write start audit event ----
    await write_audit_event(
        db,
        actor_type="agent",
        actor_id="Orchestrator",
        user_name="Orchestrator",
        action_type="Pipeline Started",
        action_details=f"Orchestrator pipeline started for circular_id={circular_id}, entity_type={entity_type}",
        trace_id=trace_id,
        entity_type="Circular",
        entity_id=str(circular_id),
    )

    # ---- Step 1: Obligation Extraction ----
    try:
        state = OrchestratorState.EXTRACTING
        obligations = await run_obligation_extraction(
            db,
            circular_id=circular_id,
            document_text=document_text,
            circular_name=circular_name,
            trace_id=trace_id,
        )
        result["obligations"] = [ob.id for ob in obligations]

        await write_audit_event(
            db,
            actor_type="agent",
            actor_id="ObligationExtractionAgent",
            user_name="ObligationExtractionAgent",
            action_type="Obligation Extraction Complete",
            action_details=f"Extracted {len(obligations)} obligations from circular '{circular_name}'.",
            trace_id=trace_id,
            entity_type="Circular",
            entity_id=str(circular_id),
        )

        # Low-confidence gate: route to reviewing if avg conf < threshold
        if obligations:
            avg_conf = sum(float(ob.confidence_score or 0) for ob in obligations) / len(obligations)
            if avg_conf < confidence_threshold:
                # Create a human-review notification
                notif = Notification(
                    org_id=org_id,
                    type="review_request",
                    title="⚠️ Human Review Required — Low Confidence Extraction",
                    body=f"Circular '{circular_name}' obligation extraction averaged {avg_conf:.0%} confidence. Please review extracted obligations.",
                    payload=json.dumps({"circular_id": circular_id, "avg_confidence": avg_conf}),
                )
                db.add(notif)
                state = OrchestratorState.REVIEWING

    except Exception as e:
        result["errors"].append(f"ObligationExtraction failed: {str(e)}")
        result["state"] = OrchestratorState.FAILED
        await db.commit()
        return result

    # ---- Step 2: Checklist Generation ----
    if obligations:
        try:
            state = OrchestratorState.GENERATING
            checklist = await run_checklist_generation(
                db,
                circular_id=circular_id,
                circular_name=circular_name,
                entity_type=entity_type,
                obligations=obligations,
                org_id=org_id,
                trace_id=trace_id,
            )
            result["checklist_id"] = checklist.id

            await write_audit_event(
                db,
                actor_type="agent",
                actor_id="ChecklistGenerationAgent",
                user_name="ChecklistGenerationAgent",
                action_type="Checklist Generated",
                action_details=f"Checklist '{checklist.name}' created with items for entity_type={entity_type}.",
                trace_id=trace_id,
                entity_type="Checklist",
                entity_id=str(checklist.id),
            )

        except Exception as e:
            result["errors"].append(f"ChecklistGeneration failed: {str(e)}")

    # ---- Step 3: Risk Scoring ----
    if obligations:
        try:
            state = OrchestratorState.RISK_SCORING
            findings = await run_risk_analysis(
                db,
                obligations=obligations,
                org_id=org_id,
                trace_id=trace_id,
            )
            result["risk_findings"] = [f.id for f in findings]

            await write_audit_event(
                db,
                actor_type="agent",
                actor_id="RiskAnalysisAgent",
                user_name="RiskAnalysisAgent",
                action_type="Risk Scoring Complete",
                action_details=f"Scored {len(findings)} risk findings. High-risk count: {sum(1 for f in findings if float(f.risk_score) >= 16)}.",
                trace_id=trace_id,
                entity_type="Circular",
                entity_id=str(circular_id),
            )

        except Exception as e:
            result["errors"].append(f"RiskAnalysis failed: {str(e)}")

    # ---- Step 4: Change Monitoring ----
    if obligations:
        try:
            state = OrchestratorState.CHANGE_MONITORING
            change_events = await run_change_monitoring(
                db,
                circular_id=circular_id,
                circular_name=circular_name,
                new_obligations=obligations,
                org_id=org_id,
                trace_id=trace_id,
            )
            result["change_events"] = change_events

            if change_events:
                await write_audit_event(
                    db,
                    actor_type="agent",
                    actor_id="ChangeMonitoringAgent",
                    user_name="ChangeMonitoringAgent",
                    action_type="Change Events Detected",
                    action_details=f"Detected {len(change_events)} potential regulatory change events.",
                    trace_id=trace_id,
                    entity_type="Circular",
                    entity_id=str(circular_id),
                )

        except Exception as e:
            result["errors"].append(f"ChangeMonitoring failed: {str(e)}")

    # ---- Finalize ----
    state = OrchestratorState.FINALIZED
    result["state"] = state

    await write_audit_event(
        db,
        actor_type="agent",
        actor_id="Orchestrator",
        user_name="Orchestrator",
        action_type="Pipeline Finalized",
        action_details=(
            f"Pipeline complete. Obligations: {len(result['obligations'])}, "
            f"Checklist: {result['checklist_id']}, "
            f"Findings: {len(result['risk_findings'])}, "
            f"Changes: {len(result['change_events'])}. "
            f"Errors: {result['errors'] or 'None'}."
        ),
        trace_id=trace_id,
        entity_type="Circular",
        entity_id=str(circular_id),
    )

    await db.commit()
    return result
