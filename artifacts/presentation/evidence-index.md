# YVY HSE Sprint 3 — Presentation Evidence Index

Status definitions: `CAPTURED` means a genuine screenshot, diagram or verified report exists. `READY_TO_CAPTURE` means the live source is ready but no final asset exists. `NOT_REQUIRED` means fallback evidence is intentionally preferred. `BLOCKED` means evidence cannot currently be produced.

## Required 17-asset register

| Asset ID | Slide | Description | Source | Capture method | Status | File | Notes |
|---|---:|---|---|---|---|---|---|
| A01 | 3 | Real YVY HSE application with Agent open | Angular localhost | Browser screenshot | CAPTURED | `screenshots/01-yvy-agent-open.png` | Genuine UI |
| A02 | 17 | Overall final architecture | Current code + final validation | Native SVG | CAPTURED | `diagrams/01-final-architecture.svg` | Refusal path included |
| A03 | 5 | LangGraph conditional flow | `hseAgent.graph.ts` | Native SVG | CAPTURED | `diagrams/02-langgraph-flow.svg` | Actual compiled nodes/edges |
| A04 | 6 | Agentic RAG flow | RAG implementation | Native SVG | CAPTURED | `diagrams/03-agentic-rag.svg` | Untrusted evidence noted |
| A05 | 9 | Real LOTO answer with citation | Angular -> API -> OpenAI -> RAG | Browser screenshot | CAPTURED | `screenshots/03-rag-loto-citation.png` | No vectors shown |
| A06 | 8 | Structured data versus RAG | Tool/RAG routing | Native SVG | CAPTURED | `diagrams/04-structured-vs-rag.svg` | Operational vs reference |
| A07 | 9 | No-relevant-evidence behavior | Live-safe + RAG tests | Verified report | CAPTURED | `reports/04-rag-evidence.md` | No fake UI |
| A08 | 10 | Thread continuity | Live-safe + Angular + state tests | Verified report | CAPTURED | `reports/05-state-memory-hitl-evidence.md` | Screenshot attempt rejected because second turn was not framed |
| A09 | 10 | Thread isolation | State suite/smoke | Verified report | CAPTURED | `reports/05-state-memory-hitl-evidence.md` | No UI view exists |
| A10 | 11 | Memory save/retrieve | Memory suite/smoke | Diagram + report | CAPTURED | `diagrams/06-memory-lifecycle.svg` | Explicit intent only |
| A11 | 11 | Memory forget | Memory suite/smoke | Diagram + report | CAPTURED | `reports/05-state-memory-hitl-evidence.md` | No UI view exists |
| A12 | 12 | HITL PENDING | Live-safe + HITL suite | Diagram + report | CAPTURED | `diagrams/07-hitl-flow.svg` | No HITL frontend view |
| A13 | 12 | HITL APPROVE | Prior controlled smoke + suite | Verified report | CAPTURED | `reports/05-state-memory-hitl-evidence.md` | Human identity limitation disclosed |
| A14 | 12 | HITL REJECT | Prior controlled smoke + suite | Verified report | CAPTURED | `reports/05-state-memory-hitl-evidence.md` | No fake output |
| A15 | 15 | Final test and Harness result | Current command output/artifacts | Verified report + visual | CAPTURED | `reports/06-test-evidence.md` | 154/154; 7/7; 5/5; 36/36; 9/9 |
| A16 | 7 | PostgreSQL/pgvector proof | Current validators/inventory | Verified report | CAPTURED | `reports/07-pgvector-evidence.md` | No vector values |
| A17 | 16 | Safe final repository structure | Current workspace | Curated tree | CAPTURED | `reports/08-repository-structure.md` | Secrets/dependencies excluded |

## Additional supporting assets

| Asset ID | Slide | Description | Status | File |
|---|---:|---|---|---|
| S01 | 13 | Real domain-scope refusal | CAPTURED | `screenshots/02-domain-scope-refusal.png` |
| S02 | 3 | Real normal in-scope response | CAPTURED | `screenshots/05-in-scope-capabilities.png` |
| S03 | 10–11 | Three context types | CAPTURED | `diagrams/05-three-contexts.svg` |
| S04 | 13–14 | Agent Harness architecture | CAPTURED | `diagrams/08-agent-harness.svg` |
| S05 | 14–15 | Harness result visual | CAPTURED | `diagrams/09-harness-results.svg` |
| S06 | 8 | Authorized historical Actions validation | CAPTURED | `reports/02-operational-actions-evidence.md` |
| S07 | 1–18 | Final technical snapshot | CAPTURED | `reports/01-final-technical-snapshot.md` |
| S08 | 13 | Domain-scope safe metadata | CAPTURED | `reports/03-domain-scope-evidence.md` |

Required assets: **17**. Captured: **17**. Ready-to-capture: **0**. Missing/blocked: **0**.
