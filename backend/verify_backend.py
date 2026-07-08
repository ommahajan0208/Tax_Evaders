import asyncio
import os
import sys

# Add backend dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User, RegulatoryRule, ComplianceTask, AuditLog
from app.auth import get_password_hash, verify_password
from app.services.vector_service import vector_manager
from app.services.gemini import generate_chat_response_stream, verify_compliance_evidence

async def main():
    print("--- SEBI Agentic Compliance Backend Verification ---")
    
    # 1. Test Config
    print(f"Project Name: {settings.PROJECT_NAME}")
    print(f"DB Path: {settings.DATABASE_URL}")
    print(f"Upload Dir: {settings.UPLOAD_DIR}")
    print(f"Vector Store Dir: {settings.VECTOR_STORE_DIR}")
    
    # 2. Initialize Database tables
    print("\n[1/4] Initializing Database & Migrations...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")
    
    # 3. Test Hashing and Auth DB Operations
    print("\n[2/4] Testing Auth Hashing & DB inserts...")
    async with SessionLocal() as db:
        hashed = get_password_hash("test_password")
        assert verify_password("test_password", hashed) is True
        assert verify_password("wrong_password", hashed) is False
        
        user = User(username="testuser", email="test@sebi.gov", hashed_password=hashed, role="user")
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Auth Success! Registered user: {user.username} with ID {user.id}")
        
    # 4. Test FAISS Vector DB additions & search
    print("\n[3/4] Testing Sentence Transformers & FAISS index...")
    # Clear local index
    vector_manager.rebuild_index()
    
    dummy_chunks = [
        {
            "text": "SEBI Stockbroker Circular Clause 2.1: Stockbrokers shall segregate client funds from broker funds and perform daily bank-ledger reconciliations. Discrepancies must be reported immediately.",
            "metadata": {"filename": "stockbroker_circular.pdf", "page_number": 2, "chunk_index": 0, "timestamp": 123456}
        },
        {
            "text": "SEBI Investment Adviser suitability Clause 5: IAs must construct a comprehensive suitability matrix and review client risk profiles annually. Records must be kept for 5 years.",
            "metadata": {"filename": "ia_circular.pdf", "page_number": 5, "chunk_index": 0, "timestamp": 123456}
        }
    ]
    
    print("Embedding and adding chunks to FAISS (may take a moment to load sentence-transformers)...")
    vector_manager.add_chunks(dummy_chunks)
    print(f"FAISS total indexed elements: {vector_manager.index.ntotal}")
    assert vector_manager.index.ntotal == 2
    
    print("Testing FAISS query semantic search...")
    search_res = vector_manager.search("segregating client money and funds", top_k=1)
    print(f"Search match size: {len(search_res)}")
    assert len(search_res) > 0
    print(f"Best match file: {search_res[0]['filename']} (Page {search_res[0]['page_number']})")
    print(f"Best match text: {search_res[0]['text']}")
    assert "segregate client funds" in search_res[0]["text"]
    print("FAISS indexing and retrieval working successfully!")
    
    # 5. Test Gemini SDK flow (Offline Fallback mode testing)
    print("\n[4/4] Testing Gemini Chat and Evidence Verifier fallback responses...")
    
    # Stream test
    print("Testing chat response streamer...")
    history = []
    print("Query: 'What are the rules for segregating client money?'")
    print("Stream Response:")
    stream_output = ""
    for token in generate_chat_response_stream("What are the rules for segregating client money?", search_res, history):
        stream_output += token
        # print token to stdout
        sys.stdout.write(token)
        sys.stdout.flush()
    print("\nStream completed.")
    assert len(stream_output) > 0
    
    # Verifier test
    print("\nTesting compliance evidence verifier...")
    criteria = "Daily reconciliation sheet showing zero discrepancy between client bank balance and client ledger balance."
    evidence_text = """
    Reconciliation Statement - Date: 2026-07-08
    Total client ledger balances: Rs. 1,50,00,000
    Total bank ledger balance: Rs. 1,50,00,000
    Discrepancy: 0 (Zero)
    Status: Compliant
    """
    ver_res = verify_compliance_evidence(criteria, evidence_text)
    print(f"Compliance Verifier Output: {ver_res}")
    assert ver_res.get("is_compliant") is True
    print("\n--- ALL BACKEND CHECKS COMPLETED SUCCESSFULLY ---")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
