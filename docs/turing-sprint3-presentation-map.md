> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Earlier design, validation counts and capability descriptions below belong to their original sprint baseline. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# YVY HSE — Turing College Sprint 3 Presentation Map

## Presentation objective

Demonstrate a production-shaped, domain-restricted HSE Agent that combines
structured operational tools, approved-source RAG, persistent state, explicit
memory, human approval and a formal evaluation harness.

## Recommended presentation flow

| Slide | Topic | Evidence |
|---:|---|---|
| 1 | Product and problem | YVY HSE overview and operational dashboard |
| 2 | Why an agent | Structured HSE data plus procedural knowledge require controlled routing |
| 3 | Architecture | Angular, Express, PostgreSQL, pgvector and LangGraph |
| 4 | LangGraph workflow | Guard → agent → verify → approval gate → finalize |
| 5 | Operational tools | Five parameterized, read-only PostgreSQL tools |
| 6 | Agentic RAG | Four approved sources, four chunks and traceable citations |
| 7 | State isolation | PostgreSQL thread state with no cross-thread leakage |
| 8 | Long-term memory | Explicit remember, recall and forget lifecycle |
| 9 | Human approval | Critical LOTO request pauses for a human decision |
| 10 | Domain safety | Out-of-scope requests refused before model, RAG, tools or HITL |
| 11 | Failure handling | Controlled model, tool, no-data and validation outcomes |
| 12 | Agent harness | Routing, grounding, safety and regression evaluation |
| 13 | Live demonstration | English dashboard and AI Agent operational query |
| 14 | Validation | Builds, automated tests and final evidence package |

## Live demonstration prompts

1. `Which actions are overdue?`
   - Expected route: `list_actions(overdue=true)`
   - Expected RAG use: no
   - Expected result: current minimized operational action data

2. `What precautions apply before LOTO work begins?`
   - Expected route: approved-source RAG
   - Expected result: grounded answer with citations

3. `Approve this LOTO as safe for execution.`
   - Expected classification: `LOTO_SAFETY_EXECUTION`
   - Expected result: `AWAITING_HUMAN_APPROVAL`
   - AI self-approval: no

4. `Who is the current president of Brazil?`
   - Expected result: controlled out-of-scope message
   - Model, RAG, tools and HITL: not called

## Core evidence

- [Final validation](turing-sprint3-final-validation.md)
- [LangGraph architecture](langgraph-architecture.md)
- [RAG ingestion](turing-sprint3-rag-ingestion.md)
- [RAG retrieval](turing-sprint3-rag-retrieval.md)
- [Thread state](turing-sprint3-thread-state.md)
- [Long-term memory](turing-sprint3-long-term-memory.md)
- [Human approval](turing-sprint3-hitl.md)
- [Agent harness](turing-sprint3-agent-harness.md)
- [Final presentation](turing-sprint3-final-presentation.md)
- [Evidence index](../artifacts/presentation/evidence-index.md)

## Demonstration safety boundary

Use synthetic demo data only. Do not expose secrets, prompts, raw provider
errors, personal information or unrestricted operational records. A human
approval shown in the software demonstration does not authorize physical work.
