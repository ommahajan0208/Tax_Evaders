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
