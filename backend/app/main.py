from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import date
import json

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User, RegulatoryRule, ComplianceTask, AuditLog
from app.auth import get_password_hash
from app.routers import auth, documents, chat, compliance, admin
from app.routers import checklists, risk, circulars, notifications, reports

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize DB tables (creates all new tables too)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # 2. Seed Mock Regulatory scenario & Admin user
    async with SessionLocal() as db:
        from sqlalchemy import select

        # Admin user
        admin_check = await db.execute(select(User).where(User.username == "admin"))
        admin_exists = admin_check.scalars().first()
        
        if not admin_exists:
            hashed_pwd = get_password_hash("adminpassword")
            admin_user = User(
                username="admin",
                email="admin@compliance.sebi",
                hashed_password=hashed_pwd,
                role="admin",
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            print("Admin user seeded (admin / adminpassword)")
            
        # Seed stockbroker segregation rule
        rule_check = await db.execute(select(RegulatoryRule).where(RegulatoryRule.section_reference == "Section 2.1"))
        rule_exists = rule_check.scalars().first()
        
        if not rule_exists:
            stockbroker_rule = RegulatoryRule(
                circular_name="SEBI Master Circular for Stockbrokers 2024",
                section_reference="Section 2.1",
                intermediary_type="Stockbroker",
                obligation_text=(
                    "Stockbrokers must segregate client funds and client securities from their own "
                    "funds and securities, and perform daily reconciliations. Client bank account balances "
                    "shall be reconciled daily against client ledger accounts to verify zero discrepancies. "
                    "Proprietary balances must not mix with client accounts."
                ),
                frequency="Daily",
                verification_criteria=(
                    "Daily reconciliation sheet showing zero discrepancy between client bank balance "
                    "and client ledger balance. Must contain a summary table listing 'Client Ledger Total', "
                    "'Client Bank Account Total', and 'Discrepancy: 0'."
                )
            )
            db.add(stockbroker_rule)
            await db.commit()
            await db.refresh(stockbroker_rule)
            print("Stockbroker Segregation rule seeded.")
            
            task = ComplianceTask(
                rule_id=stockbroker_rule.id,
                assignee_department="Finance",
                due_date=date.today(),
                status="Pending"
            )
            db.add(task)
            await db.commit()
            print("Compliance Task for Section 2.1 due today seeded.")
            
            log = AuditLog(
                task_id=task.id,
                user_name="System Agent",
                actor_type="agent",
                action_type="Database Seed",
                action_details="Pre-seeded Section 2.1 segregation rule and compliance calendar task."
            )
            db.add(log)
            await db.commit()
            
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Agentic Compliance OS — multi-agent regulatory intelligence powered by Gemini 2.5 Flash.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Core Routers ----
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(compliance.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

# ---- New Agentic Routers ----
app.include_router(checklists.router, prefix=settings.API_V1_STR)
app.include_router(risk.router, prefix=settings.API_V1_STR)
app.include_router(circulars.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "2.0.0 — Agentic Compliance OS",
        "database": "connected"
    }
