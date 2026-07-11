"""
Risk Analysis Agent — PRD §6.2.4, §13
=======================================
Scores each Obligation: risk_score = likelihood × impact (1–5 each).
Persists RiskFinding rows. Auto-escalates findings with score ≥ 16.
"""
import json
import time
import uuid
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AgentExecution, Notification, Obligation, RiskFinding
from app.services.gemini import score_risk_factors


async def run_risk_analysis(
    db: AsyncSession,
    *,
    obligations: List[Obligation],
    org_id: Optional[int] = None,
    escalation_threshold: float = 16.0,
    trace_id: Optional[str] = None,
) -> List[RiskFinding]:
    """
    Score each obligation for risk and persist RiskFinding records.
    Findings with risk_score >= escalation_threshold trigger a notification.
    """
    trace_id = trace_id or str(uuid.uuid4())
    start_ms = int(time.time() * 1000)
    findings = []

    for ob in obligations:
        # Get LLM-assisted risk factors
        factors = score_risk_factors(
            obligation_text=ob.obligation_text,
            entity_type=ob.obligated_entity_type or "all",
            deadline_type=ob.deadline_type or "unknown",
        )

        likelihood = float(factors.get("likelihood", 2))
        impact = float(factors.get("impact", 2))
        risk_score = round(likelihood * impact, 2)
        rationale = factors.get("rationale", "Auto-scored by Risk Analysis Agent.")

        finding = RiskFinding(
            org_id=org_id,
            obligation_id=ob.id,
            risk_score=risk_score,
            likelihood=likelihood,
            impact=impact,
            rationale=rationale,
            status="open",
        )
        db.add(finding)
        findings.append(finding)

        # Auto-escalate high risk
        if risk_score >= escalation_threshold:
            notif = Notification(
                org_id=org_id,
                type="risk_escalation",
                title=f"🔴 High-Risk Obligation Detected (Score: {risk_score})",
                body=(
                    f"Obligation: {ob.obligation_text[:200]}...\n"
                    f"Likelihood: {likelihood}/5 · Impact: {impact}/5 · Score: {risk_score}/25\n"
                    f"Rationale: {rationale}"
                ),
                payload=json.dumps({"obligation_id": ob.id, "risk_score": risk_score}),
            )
            db.add(notif)

    await db.flush()

    duration_ms = int(time.time() * 1000) - start_ms

    exec_record = AgentExecution(
        trace_id=trace_id,
        agent_name="RiskAnalysisAgent",
        input_payload=json.dumps({
            "obligation_count": len(obligations),
            "org_id": org_id,
        }),
        output_payload=json.dumps({
            "findings_count": len(findings),
            "high_risk_count": sum(1 for f in findings if float(f.risk_score) >= escalation_threshold),
        }),
        confidence_score=0.85,
        status="success",
        duration_ms=duration_ms,
    )
    db.add(exec_record)
    await db.flush()

    return findings
