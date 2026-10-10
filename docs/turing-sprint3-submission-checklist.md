> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Earlier design, validation counts and capability descriptions below belong to their original sprint baseline. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# Project Sprint 3 — Submission Checklist

| Item | Status | Evidence / action |
|---|---|---|
| Source code | READY | Current workspace; complete validation PASS |
| README / run instructions | READY | Root `README.md` updated with current AI/RAG/test commands |
| Architecture documentation | READY | `docs/architecture.md`, final validation and diagrams |
| Final validation | READY | `docs/turing-sprint3-final-validation.md` |
| RAG documentation | READY | Ingestion and retrieval documents |
| State documentation | READY | Persistent thread-state document |
| Memory documentation | READY | Controlled long-term-memory document |
| HITL documentation | READY | Controlled HITL document |
| Harness documentation | READY | Agent Harness document |
| Evaluation reports | READY | Safe JSON/Markdown reports in `artifacts/evaluation/` |
| Presentation content | READY | 18 slides in `docs/turing-sprint3-final-presentation.md` |
| Demo script | READY | Seven demos with fallbacks |
| Evidence assets | READY | 17/17 required assets captured/indexed |
| Reviewer Q&A | READY | Dedicated final Q&A document |
| Secrets excluded | PASS | Safe scan; `.env` ignored/untracked |
| Environment example | READY | Placeholder-only `backend/.env.example` |
| PowerPoint | NOT REQUIRED | Authoritative content supplied as Markdown; polished production is separate |

## Verified run commands

### Database

```powershell
cd database
npm install
# Configure DATABASE_URL in backend/.env; never commit the real value.
node migrate.js
node seed.js
npm run validate:pgvector
npm run validate:operational-integrity
```

PostgreSQL must have the `vector` extension available. The current verified environment is PostgreSQL 16.14 with pgvector 0.8.6.

### Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Set DATABASE_URL and at least OPENAI_API_KEY for the verified live path.
npm run dev
npm run typecheck
npm run build
npm test
npm run eval:harness
npm run agent:evaluate
npm run rag:ingest -- --dry-run
```

### Frontend

```powershell
cd frontend
npm install
npm start
npm run build
npm run test:ci
```

Open `http://localhost:4200`. Backend default: `http://localhost:3000`.

## Final package check

- Do not include `backend/.env`.
- Do not include dependency trees, build output, runtime logs or backup dumps unless explicitly required.
- Include safe evidence, diagrams, final presentation content, demo script and evaluation reports.
- Do not claim the five repository interpretations are verbatim Project requirements.
- Do not repeat real external Actions egress for presentation capture.
