# Tax Evaders — SEBI Agentic Compliance

An AI-assisted compliance system for SEBI regulations. It turns regulatory circulars into structured compliance obligations, tracks tasks, and answers questions about the rules.

## Structure

- `backend/` — FastAPI server (auth, document upload, rule extraction, chat, reports)
- `frontend/` — React + Vite + Tailwind web app
- `docs/` — product and agent specifications
- `Agentic-Compliance-PRD-SRS-TDD.md` — full PRD / SRS / TDD

## Getting started

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Optionally create `backend/.env` with `SECRET_KEY` and `GEMINI_API_KEY` (needed for the LLM features). Never commit `.env`.

> The server seeds a default `admin` account on first start. Change its password before using this beyond local development.
