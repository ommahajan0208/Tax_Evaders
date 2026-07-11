"""
Citation Agent — PRD §6.2.5
==============================
Post-generation entailment verifier.
Every claim in the LLM answer is checked against retrieved source chunks.
Unsupported claims are flagged and the confidence score is adjusted.
"""
import uuid
import json
import time
from typing import Any, Dict, List, Optional

from app.services.gemini import check_citation_entailment


def run_citation_check(
    answer: str,
    context_chunks: List[Dict[str, Any]],
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Verify each sentence of the answer is supported by at least one context chunk.

    Returns:
        {
          "verified_answer": str,       # answer with unsupported claims flagged
          "confidence_score": float,    # 0.0 – 1.0
          "unsupported_claims": List[str],
          "citation_valid": bool,
        }
    """
    trace_id = trace_id or str(uuid.uuid4())
    start_ms = int(time.time() * 1000)

    if not context_chunks:
        return {
            "verified_answer": answer,
            "confidence_score": 0.3,
            "unsupported_claims": ["No source chunks were retrieved."],
            "citation_valid": False,
        }

    result = check_citation_entailment(answer=answer, context_chunks=context_chunks)
    duration_ms = int(time.time() * 1000) - start_ms

    return {
        "verified_answer": result.get("verified_answer", answer),
        "confidence_score": float(result.get("confidence_score", 0.8)),
        "unsupported_claims": result.get("unsupported_claims", []),
        "citation_valid": result.get("citation_valid", True),
        "duration_ms": duration_ms,
    }
