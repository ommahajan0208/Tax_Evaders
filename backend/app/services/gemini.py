import os
import json
import time
from typing import List, Dict, Any, Generator
import google.generativeai as genai
from app.config import settings

# Configure Gemini SDK
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
def get_gemini_model():
    if settings.GEMINI_API_KEY:
        return genai.GenerativeModel("gemini-2.5-flash")
    return None

def build_rag_prompt(question: str, context_chunks: List[Dict[str, Any]], chat_history: List[Dict[str, Any]]) -> str:
    """Assembles context, history, and system instructions into the LLM prompt."""
    context_str = ""
    for idx, chunk in enumerate(context_chunks):
        context_str += f"Source [{idx+1}]: {chunk['filename']} (Page {chunk['page_number']})\n"
        context_str += f"Content: {chunk['text']}\n\n"
        
    history_str = ""
    for msg in chat_history[-6:]:  # Keep last 6 exchanges
        history_str += f"{msg['role'].capitalize()}: {msg['content']}\n"
        
    prompt = f"""You are the SEBI Agentic Compliance & Regulatory AI Assistant.
Your primary role is to answer questions using only the provided regulatory context chunks.

=== SYSTEM INSTRUCTIONS ===
1. Answer the question using ONLY the provided Source context chunks.
2. Cite your sources using bracketed numbers corresponding to the sources provided, e.g. [1], [2].
3. If the provided context is insufficient to answer the question, or if you cannot find the answer in the sources, state clearly: "I am sorry, but the uploaded regulatory documents do not contain information to answer this question." Do not make up any information.
4. Keep the tone professional, objective, and regulatory-focused.

=== CONTEXT CHUNKS ===
{context_str}

=== CONVERSATION HISTORY ===
{history_str}

=== USER QUESTION ===
User: {question}
Assistant:"""
    return prompt

def generate_chat_response_stream(
    question: str, 
    context_chunks: List[Dict[str, Any]], 
    chat_history: List[Dict[str, Any]]
) -> Generator[str, None, None]:
    """
    Streams the chat response token-by-token.
    If GEMINI_API_KEY is not set, streams a mock response.
    """
    model = get_gemini_model()
    prompt = build_rag_prompt(question, context_chunks, chat_history)
    
    if model:
        try:
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"\n[Gemini API Error: {str(e)}. Falling back to local offline analysis.]\n"
            yield from _mock_chat_stream(question, context_chunks)
    else:
        yield from _mock_chat_stream(question, context_chunks)

def _mock_chat_stream(question: str, context_chunks: List[Dict[str, Any]]) -> Generator[str, None, None]:
    """Streams a mock response when Gemini API key is missing."""
    time.sleep(0.5)
    yield "Hello! I am operating in **Offline Mode** (no `GEMINI_API_KEY` was found). "
    yield "Here is an automated response based on the local context chunks retrieved:\n\n"
    
    if not context_chunks:
        yield "I couldn't find any relevant chunks in the vector database to answer your question. Please ensure you have uploaded and indexed the SEBI circulars."
        return

    yield f"Based on the document **{context_chunks[0]['filename']}** (Page {context_chunks[0]['page_number']}), "
    yield "the rule requires: \n\n"
    
    words = context_chunks[0]['text'].split(" ")
    for i in range(0, len(words), 5):
        chunk_words = " ".join(words[i:i+5]) + " "
        time.sleep(0.05)
        yield chunk_words

    yield "\n\n*(Note: This response was generated locally using the offline fallback model due to missing API configurations.)*"


def extract_regulatory_rules(circular_name: str, document_text: str) -> List[Dict[str, Any]]:
    """
    Parses unstructured PDF text to extract structural regulatory rules using Gemini 2.5 Flash.
    Returns list of dicts.
    """
    model = get_gemini_model()
    prompt = f"""Analyze this text from the SEBI regulatory circular: '{circular_name}'.
Identify and extract all regulatory rules, compliance obligations, and tasks.

For each rule or obligation, output a JSON array of objects with the exact schema:
[
  {{
    "section_reference": "e.g., Section 2.1 or Paragraph 4.a",
    "intermediary_type": "Stockbroker or Investment Adviser or both",
    "obligation_text": "Detailed text of what must be done by the intermediary",
    "frequency": "Daily, Weekly, Monthly, Quarterly, Annually, or Event-based",
    "verification_criteria": "What concrete evidence or document must be uploaded to prove compliance (e.g., bank reconciliation sheet, client ledger log, audit certificate)"
  }}
]

TEXT:
{document_text[:12000]}
"""

    if model:
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return data
        except Exception as e:
            print(f"Error calling Gemini for rule extraction: {e}")
            return _mock_rule_extraction(circular_name)
    else:
        return _mock_rule_extraction(circular_name)

def _mock_rule_extraction(circular_name: str) -> List[Dict[str, Any]]:
    """Mock rule extractor when Gemini API is unavailable or fails."""
    # Let's check if the document is related to Stockbrokers or Investment Advisers
    name_lower = circular_name.lower()
    if "broker" in name_lower or "sebi" in name_lower:
        return [
            {
                "section_reference": "Section 2.1",
                "intermediary_type": "Stockbroker",
                "obligation_text": "Stockbrokers shall segregate client funds from broker funds and perform daily reconciliations. Client bank balances must match the client ledger balances without discrepancies.",
                "frequency": "Daily",
                "verification_criteria": "Daily reconciliation sheet showing zero discrepancy between client bank balance and client ledger balance."
            },
            {
                "section_reference": "Section 4.2",
                "intermediary_type": "Stockbroker",
                "obligation_text": "Stockbrokers must submit quarterly internal audit reports to the stock exchange within 45 days from the end of the quarter.",
                "frequency": "Quarterly",
                "verification_criteria": "Internal Audit Report signed by a Chartered Accountant along with the stock exchange upload acknowledgement receipt."
            }
        ]
    else:
        return [
            {
                "section_reference": "Section 1.1",
                "intermediary_type": "Investment Adviser",
                "obligation_text": "Investment Advisers must maintain client risk profiling and suitability assessment records for a period of five years.",
                "frequency": "Daily",
                "verification_criteria": "Risk profiling logs and signed client suitability forms."
            }
        ]


def verify_compliance_evidence(criteria: str, evidence_text: str) -> Dict[str, Any]:
    """
    Compares extracted text from uploaded proof against target verification criteria.
    Returns structured feedback.
    """
    model = get_gemini_model()
    prompt = f"""Verify whether the uploaded compliance evidence satisfies the verification criteria.

=== VERIFICATION CRITERIA ===
{criteria}

=== UPLOADED EVIDENCE CONTENTS ===
{evidence_text}

=== INSTRUCTIONS ===
Analyze the evidence content and determine if it fully matches the verification criteria.
Look for discrepancies, negative balances, mismatch in totals, missing signatures, or incorrect dates.
Output a JSON object with the exact keys:
{{
  "is_compliant": true/false (boolean),
  "feedback": "A detailed explanation of why the evidence is compliant or what is missing/incorrect.",
  "anomalies": "A string listing any specific anomalies detected (e.g. balance mismatch of Rs 50000) or 'None'"
}}
"""

    if model:
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return data
        except Exception as e:
            print(f"Error calling Gemini for evidence verification: {e}")
            return _mock_evidence_verification(criteria, evidence_text)
    else:
        return _mock_evidence_verification(criteria, evidence_text)

def _mock_evidence_verification(criteria: str, evidence_text: str) -> Dict[str, Any]:
    """Mock verifier. Performs simple string parsing for mock execution."""
    text_lower = evidence_text.lower()
    
    # Simple heuristics to check if the uploaded document is compliant
    if "reconciliation" in text_lower or "ledger" in text_lower:
        # Check if there is discrepancy mentioned
        if "discrepancy: zero" in text_lower or "discrepancy: 0" in text_lower or "mismatch: 0" in text_lower or "compliant" in text_lower:
            return {
                "is_compliant": True,
                "feedback": "Offline Verification: The uploaded reconciliation statement confirms zero discrepancy. Balances in the ledger and bank account match. All checks are satisfied.",
                "anomalies": "None"
            }
        elif "discrepancy: " in text_lower and not "discrepancy: 0" in text_lower:
            # Found discrepancy!
            return {
                "is_compliant": False,
                "feedback": "Offline Verification FAILED: The uploaded reconciliation report outlines discrepancies between client ledger and bank records.",
                "anomalies": "Discrepancy detected in ledger logs."
            }
        else:
            return {
                "is_compliant": True,
                "feedback": "Offline Verification: Document uploaded. Detected reconciliation ledger structure. Marking as compliant (offline mock mode).",
                "anomalies": "None"
            }
    else:
        return {
            "is_compliant": False,
            "feedback": "Offline Verification FAILED: The uploaded document does not appear to contain relevant reconciliation details or is of an incorrect format.",
            "anomalies": "No reconciliation ledger keywords found."
        }


# ===========================================================================
# NEW: Structured Obligation Extraction (PRD §6.2.2)
# ===========================================================================

def extract_obligations_structured(circular_name: str, document_text: str) -> List[Dict[str, Any]]:
    """
    Extracts structured obligations from document text using Gemini.
    JSON schema: [{obligated_entity_type, obligation_text, section_reference,
                   deadline_type, deadline_value, penalty_description, confidence}]
    """
    model = get_gemini_model()
    prompt = f"""You are an expert SEBI regulatory analyst. Analyze this text from the circular: '{circular_name}'.

Extract EVERY regulatory obligation (every "shall", "must", "is required to" clause).

Output a JSON array with objects using EXACTLY this schema:
[
  {{
    "obligated_entity_type": "broker | dp | amc | rta | listed_co | all",
    "obligation_text": "Full text of what must be done",
    "section_reference": "e.g. Section 2.1 or Regulation 9(b) — or null if not found",
    "deadline_type": "fixed | recurring | event_triggered | null",
    "deadline_value": "human-readable deadline e.g. '30 days from registration' or null",
    "penalty_description": "Penalty if mentioned, else null",
    "confidence": 0.95
  }}
]

Rules:
- Only include genuine obligations with "shall/must/is required to" language.
- Split compound obligations only if they have separate, independently verifiable actions.
- Keep confidence between 0.5 and 1.0 based on how clear the obligation is.
- Return an empty array [] if no obligations found.

TEXT:
{document_text[:15000]}
"""
    if model:
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            if isinstance(data, list):
                return data
            return []
        except Exception as e:
            print(f"Gemini obligation extraction error: {e}")
            return _mock_obligations_structured(circular_name)
    else:
        return _mock_obligations_structured(circular_name)


def _mock_obligations_structured(circular_name: str) -> List[Dict[str, Any]]:
    """Fallback mock obligations when Gemini is unavailable."""
    name_lower = circular_name.lower()
    base = "broker" if "broker" in name_lower else "all"
    return [
        {
            "obligated_entity_type": base,
            "obligation_text": "Stockbrokers shall segregate client funds from proprietary funds and maintain daily reconciliation records showing zero discrepancy.",
            "section_reference": "Section 2.1",
            "deadline_type": "recurring",
            "deadline_value": "Daily — end of trading day",
            "penalty_description": "Regulatory action and penalty as per SEBI guidelines.",
            "confidence": 0.92,
        },
        {
            "obligated_entity_type": base,
            "obligation_text": "Stockbrokers must submit quarterly internal audit reports to the stock exchange within 45 days from the end of each quarter.",
            "section_reference": "Section 4.2",
            "deadline_type": "recurring",
            "deadline_value": "Quarterly — within 45 days of quarter end",
            "penalty_description": None,
            "confidence": 0.88,
        },
        {
            "obligated_entity_type": base,
            "obligation_text": "Every stockbroker shall maintain KYC records for all clients for a minimum period of five years.",
            "section_reference": "Section 6.1",
            "deadline_type": "event_triggered",
            "deadline_value": "At the time of client onboarding and maintained for 5 years.",
            "penalty_description": None,
            "confidence": 0.85,
        },
    ]


# ===========================================================================
# NEW: Citation Entailment Check (PRD §6.2.5)
# ===========================================================================

def check_citation_entailment(
    answer: str,
    context_chunks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    LLM-as-judge: verify each claim in the answer is supported by context_chunks.
    Returns: {verified_answer, confidence_score, unsupported_claims, citation_valid}
    """
    model = get_gemini_model()
    context_str = "\n\n".join(
        f"[Source {i+1}]: {c.get('text', c.get('text_preview', ''))}"
        for i, c in enumerate(context_chunks[:5])
    )
    prompt = f"""You are a citation verification agent for SEBI regulatory compliance.

ANSWER TO VERIFY:
{answer[:3000]}

RETRIEVED SOURCE CHUNKS:
{context_str[:5000]}

TASK: Check if every factual claim in the ANSWER is supported by at least one SOURCE CHUNK.

Output a JSON object:
{{
  "verified_answer": "The answer text, with [UNVERIFIED] prepended to any claim not traceable to a source.",
  "confidence_score": 0.95,
  "unsupported_claims": ["list of claim strings that could not be traced to sources"],
  "citation_valid": true
}}

If all claims are supported, return the answer unchanged with citation_valid=true.
"""
    if model:
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return data
        except Exception as e:
            print(f"Gemini citation entailment error: {e}")
            return _mock_citation_check(answer, context_chunks)
    else:
        return _mock_citation_check(answer, context_chunks)


def _mock_citation_check(answer: str, context_chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Mock citation check — assumes all claims are supported when API is unavailable."""
    score = 0.85 if context_chunks else 0.3
    return {
        "verified_answer": answer,
        "confidence_score": score,
        "unsupported_claims": [] if context_chunks else ["No source chunks provided."],
        "citation_valid": bool(context_chunks),
    }


# ===========================================================================
# NEW: Risk Factor Scoring (PRD §6.2.4, §13)
# ===========================================================================

def score_risk_factors(
    obligation_text: str,
    entity_type: str,
    deadline_type: str,
) -> Dict[str, Any]:
    """
    LLM-assisted risk factor extraction.
    Returns: {likelihood: 1-5, impact: 1-5, rationale: str}
    """
    model = get_gemini_model()
    prompt = f"""You are a SEBI compliance risk analyst. Score this regulatory obligation for risk.

OBLIGATION: {obligation_text[:1000]}
ENTITY TYPE: {entity_type}
DEADLINE TYPE: {deadline_type}

Score likelihood (1=very unlikely to miss, 5=very likely to miss) and
impact (1=minimal consequence, 5=severe regulatory/financial consequence).

Output JSON:
{{
  "likelihood": 3,
  "impact": 4,
  "rationale": "Brief 1-2 sentence explanation of why you scored this way."
}}
"""
    if model:
        try:
            response = model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            return data
        except Exception as e:
            print(f"Gemini risk scoring error: {e}")
            return _mock_risk_score(obligation_text, deadline_type)
    else:
        return _mock_risk_score(obligation_text, deadline_type)


def _mock_risk_score(obligation_text: str, deadline_type: str) -> Dict[str, Any]:
    """Mock risk score using heuristics."""
    text_lower = obligation_text.lower()
    impact = 4 if any(w in text_lower for w in ["penalty", "sebi", "inspection", "client fund", "segregat"]) else 3
    likelihood = 3 if "daily" in (deadline_type or "").lower() else 2
    return {
        "likelihood": likelihood,
        "impact": impact,
        "rationale": f"Heuristic score: impact={impact} (obligation type analysis), likelihood={likelihood} (deadline frequency).",
    }


# ===========================================================================
# NEW: Report Narrative Generation (PRD §10.9, §14.4)
# ===========================================================================

def generate_report_narrative(
    report_type: str,
    scope_summary: str,
    data_summary: str,
) -> str:
    """
    Generate a human-readable audit/compliance/risk report narrative.
    Returns Markdown-formatted report text.
    """
    model = get_gemini_model()
    prompt = f"""You are a professional SEBI compliance report writer. Generate a formal {report_type} report.

SCOPE: {scope_summary}
DATA SUMMARY: {data_summary}

Write a professional compliance report in Markdown format with:
- Executive Summary
- Key Findings (use a table)
- Compliance Status Summary
- Risk Assessment
- Recommended Actions
- Conclusion

Be precise, professional, and cite the data provided. Do not fabricate figures not in the data summary.
"""
    if model:
        try:
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"Gemini report generation error: {e}")
            return _mock_report_narrative(report_type, scope_summary, data_summary)
    else:
        return _mock_report_narrative(report_type, scope_summary, data_summary)


def _mock_report_narrative(report_type: str, scope_summary: str, data_summary: str) -> str:
    return f"""# {report_type.replace('_', ' ').title()} Report

**Scope:** {scope_summary}

## Executive Summary
This report summarizes the compliance posture based on available data. *(Generated in offline mode)*

## Data Overview
{data_summary}

## Key Findings
| Category | Status |
|---|---|
| Compliance | Under review |
| Risk Level | Medium |

## Recommended Actions
1. Review all open obligations and assign owners.
2. Ensure evidence is uploaded for all pending tasks.
3. Escalate overdue items to compliance officer.

## Conclusion
This report was generated by the Agentic Compliance OS. Please verify with a qualified compliance professional.
"""
