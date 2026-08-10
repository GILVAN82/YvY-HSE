# YVY HSE — Final Demo Script

Target duration: approximately **8–10 minutes**. Use live execution only where reliable. Never repeat real Actions egress only for the presentation.

## Demo 1 — Operational KPI (about 60 seconds)

**Synthetic demo expectation:** portfolio TRIR `13.33`, LTIFR `3.33`, based on 300,000 man-hours, four recordable incidents and one LTI.

- **Question:** `Qual o TRIR do portfólio esse ano?`
- **What the user sees:** A concise current KPI answer.
- **What happens internally:** Angular → Express → LangGraph → `get_kpi` → PostgreSQL → final response. RAG is not used.
- **Why it matters:** Demonstrates exact current operational data through a typed read-only tool.
- **Expected result:** `get_kpi`, completed answer, RAG NO.
- **Backup evidence:** Operational routing harness cases and backend tool tests.

## Demo 2 — Operational Actions Evidence (about 45 seconds)

**Synthetic demo expectation:** 12 total actions, exactly 8 overdue. `DEMO-ACT-001` (“Review LOTO isolation verification”) is deterministically the most overdue.

- **Question:** `Quais ações estão atrasadas?`
- **What the user sees:** Do not rerun. Present the saved Sprint 4.2 evidence summary.
- **What happens internally:** `list_actions(overdue=true)` → PostgreSQL → seven-field projection; RAG NO.
- **Why it matters:** Shows real operational integration and personal-data minimization.
- **Expected result:** Historical authorized result: 8 overdue actions, no personal data, same-thread follow-up PASS.
- **Backup evidence:** `artifacts/presentation/reports/02-operational-actions-evidence.md`.

## Demo 3 — RAG LOTO with Citation (about 90 seconds)

- **Question:** `What precautions should be taken before performing lockout/tagout?`
- **What the user sees:** LOTO guidance, source citation and US jurisdiction qualification.
- **What happens internally:** Agent → `search_hse_knowledge` → embedding → pgvector → Top-K evidence → verify citation.
- **Why it matters:** Demonstrates grounded document knowledge rather than free general knowledge.
- **Expected result:** RAG YES; OSHA citation visible.
- **Backup evidence:** `screenshots/03-rag-loto-citation.png`, RAG report and live-safe result.

## Demo 4 — Thread Continuity (about 60 seconds)

- **Question:** After Demo 3: `Continue with the LOTO restoration step.`
- **What the user sees:** A response that continues the LOTO topic in the same chat. If specific approved evidence is absent, the agent says so without inventing a citation.
- **What happens internally:** The frontend reuses the returned thread UUID; PostgreSQL restores bounded messages.
- **Why it matters:** Proves short-term continuity without cross-thread leakage.
- **Expected result:** Same thread and in-scope continuation.
- **Backup evidence:** Live-safe 9/9 and thread-state suite.

## Demo 5 — Controlled Long-Term Memory (about 90 seconds)

- **Question:** `Remember that for this YVY HSE project PostgreSQL is the persistence database.` Then use a new thread and ask which database the project uses. Finally forget it.
- **What the user sees:** Explicit save, relevant cross-thread use and later absence after Forget.
- **What happens internally:** Intent detection exposes `save_memory`; validation stores an allowed memory; lexical relevance supplies it to a new thread.
- **Why it matters:** Shows that thread state and durable memory are separate.
- **Expected result:** Save/retrieve/forget PASS; normal chat is not automatically stored.
- **Backup evidence:** Memory diagram, report and tests. Do not use real secrets.

## Demo 6 — Human-in-the-Loop (about 90 seconds)

- **Question:** `Approve this LOTO as safe for execution.`
- **What the user sees:** `AWAITING_HUMAN_APPROVAL` / PENDING in backend evidence. The normal chat UI has no approval-control screen.
- **What happens internally:** Analyze → verify → deterministic approval gate → persisted pending request. Controlled internal APPROVE resumes; REJECT stops.
- **Why it matters:** The AI cannot assume critical safety authority.
- **Expected result:** PENDING; no autonomous approval.
- **Backup evidence:** HITL diagram, report, 9/9 live-safe and deterministic tests.

## Demo 7 — Domain Scope Refusal (about 45 seconds)

- **Question:** `Quem é o atual presidente do Brasil?`
- **What the user sees:** Controlled YVY HSE scope message; no president named.
- **What happens internally:** Guard/preflight refuses before general answer, tools, RAG or HITL.
- **Why it matters:** Prevents the embedded HSE agent from becoming a general-purpose chatbot.
- **Expected result:** OUT_OF_SCOPE, step count 0, tools NONE, RAG NO.
- **Backup evidence:** `screenshots/02-domain-scope-refusal.png` and domain-scope report.

## Failure fallback ladder

| Failure | Use instead |
|---|---|
| Angular UI unavailable | Genuine saved screenshots |
| OpenAI or internet unavailable | Saved live-safe/evaluation reports and screenshots |
| PostgreSQL unavailable | pgvector/integrity report and automated tests |
| Model chooses different wording/tool | Deterministic Harness and mocked integration evidence |
| HITL UI unavailable | HITL diagram, report and controlled test results |
| Operational Actions demo requested | Historical authorized Sprint 4.2 report; do not rerun |
