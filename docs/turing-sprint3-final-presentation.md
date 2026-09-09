> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Earlier design, validation counts and capability descriptions below belong to their original sprint baseline. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# YVY HSE — Final 18-Slide Presentation Content

Audience: Turing College reviewer. Communication job: by the end, the reviewer should understand that YVY HSE is a working, safety-controlled agent system with evidence for routing, grounding, state, memory, HITL and evaluation.

## Slide 1 — YVY HSE

**Subtitle:** Domain-Specific HSE AI Agent

**On-slide content**

- Turing College Sprint 3
- Agentic HSE assistance with controlled data and knowledge
- Angular · Express · LangGraph · PostgreSQL · pgvector

**Visual:** YVY HSE logo and a clean crop from `artifacts/presentation/screenshots/01-yvy-agent-open.png`.

**Simple English talk track:** “This is the YVY HSE AI Agent. It is part of an existing HSE management system. The agent can consult operational data and approved safety knowledge, but it cannot change records or approve critical work.”

**Demo:** None.

**Technical evidence:** `artifacts/presentation/reports/01-final-technical-snapshot.md`.

**Fallback:** Technical snapshot report.

## Slide 2 — HSE Data Is Useful but Dispersed

**On-slide content**

- 42 HSE tables
- 784 operational rows
- KPIs, projects, incidents, actions and permits
- Users should not need to know every table

**Visual:** Simple problem flow: many tables → one natural-language interface.

**Simple English talk track:** “The system already contained useful HSE data, but the information was spread across many tables and screens. The agent gives HSE users one natural-language entry point.”

**Demo:** None.

**Technical evidence:** `docs/agent-purpose.md`; database integrity report.

**Fallback:** `reports/01-final-technical-snapshot.md`.

## Slide 3 — The Agent Lives Inside the Real Application

**On-slide content**

- Angular UI
- Streaming answers
- Current provider availability
- Same-thread conversation
- New conversation after 15 minutes of inactivity

**Visual:** `screenshots/01-yvy-agent-open.png` or `screenshots/05-in-scope-capabilities.png`.

**Simple English talk track:** “This is not a separate prototype screen. The agent runs inside the real Angular application and calls the real Express API.”

**Demo:** Open the Agent and ask what it can consult.

**Technical evidence:** Frontend tests 7/7; real UI smoke.

**Fallback:** Saved UI screenshots.

## Slide 4 — Why Use an Agentic Architecture?

**On-slide content**

- Different questions need different data paths
- The model can select a typed tool
- The system checks the result before delivery
- Safety decisions remain deterministic

**Visual:** Question → decide → tool/RAG → verify → answer.

**Simple English talk track:** “A chatbot only generates text. This system must decide where the answer should come from, use a tool, check the result and sometimes stop for human approval. That is why we use an agent architecture.”

**Demo:** Preview operational and RAG questions.

**Technical evidence:** Agent flow and HTTP integration tests.

**Fallback:** Final architecture diagram.

## Slide 5 — LangGraph Makes the Control Flow Explicit

**On-slide content**

- Guard and domain scope
- Agent tool loop
- Verification
- Conditional approval gate
- Refusal and controlled failure paths

**Visual:** `diagrams/02-langgraph-flow.svg`.

**Simple English talk track:** “LangGraph controls what happens next. Out-of-scope input is refused. In-scope input reaches the agent. The result is verified, and critical LOTO approval pauses at the human gate.”

**Demo:** None.

**Technical evidence:** `backend/src/ai/graph/hseAgent.graph.ts`.

**Fallback:** LangGraph tests and diagram.

## Slide 6 — RAG Uses Only Approved HSE Knowledge

**On-slide content**

- 4 reviewed sources
- LOTO · PTW · Risk Assessment · Emergency Procedures
- `text-embedding-3-small`
- 1536 dimensions
- No filesystem crawling

**Visual:** `diagrams/03-agentic-rag.svg`.

**Simple English talk track:** “RAG is used for reusable document knowledge. Only four reviewed summaries can be ingested. Unregistered files and sensitive operational sources are excluded.”

**Demo:** LOTO question in Demo 3.

**Technical evidence:** RAG registry, dry-run and ingestion tests.

**Fallback:** RAG report and diagram.

## Slide 7 — PostgreSQL Also Stores Vector Evidence

**On-slide content**

- PostgreSQL 16.14
- pgvector 0.8.6
- 4 documents · 4 chunks
- Top-K 3 · similarity threshold 0.45
- Vectors never returned to the UI

**Visual:** `reports/07-pgvector-evidence.md` summarized as large numbers.

**Simple English talk track:** “The same PostgreSQL database stores the vector index. Retrieval uses cosine similarity, returns up to three relevant chunks, and never exposes the vector values.”

**Demo:** Optional validator output.

**Technical evidence:** pgvector validator PASS.

**Fallback:** Saved pgvector report.

## Slide 8 — Current Data and Reference Knowledge Stay Separate

**On-slide content**

- Operational: KPIs, projects, incidents, actions → Tools → PostgreSQL
- Reference: LOTO, PTW, risk, emergency → RAG → pgvector
- Exact data is not answered by similarity search

**Visual:** `diagrams/04-structured-vs-rag.svg`.

**Simple English talk track:** “We use tools for current operational information. We use RAG for document knowledge. This keeps exact database questions away from semantic search.”

**Demo:** KPI live; Actions use saved authorized evidence.

**Technical evidence:** Routing tests and Sprint 4.2 report.

**Fallback:** `reports/02-operational-actions-evidence.md`.

## Slide 9 — Grounding Requires Real Citations

**On-slide content**

- Retrieved source metadata is traceable
- Evidence is treated as untrusted data
- Missing citations fail verification
- No evidence means no fabricated citation
- Jurisdiction is always qualified

**Visual:** `screenshots/03-rag-loto-citation.png`.

**Simple English talk track:** “The agent cannot invent a source label. If RAG evidence is used, the response must contain a citation returned by retrieval. If no relevant evidence exists, the agent says so.”

**Demo:** LOTO RAG answer.

**Technical evidence:** Grounding, false-citation and no-evidence tests.

**Fallback:** RAG evidence report.

## Slide 10 — Thread State Continues One Conversation

**On-slide content**

- Stable thread UUID
- PostgreSQL persistence
- Last 30 messages
- Same-thread continuity
- Cross-thread isolation

**Visual:** `diagrams/05-three-contexts.svg`, focus on the center column.

**Simple English talk track:** “Thread state keeps one conversation together. A different thread receives different context. It is not long-term memory.”

**Demo:** LOTO follow-up.

**Technical evidence:** Thread-state suite and 9/9 live-safe report.

**Fallback:** `reports/05-state-memory-hitl-evidence.md`.

## Slide 11 — Long-Term Memory Is Explicit and Removable

**On-slide content**

- Only explicit “Remember that…” intent
- Four allowed categories
- No secrets or personal data
- Cross-thread retrieval
- Update and Forget lifecycle

**Visual:** `diagrams/06-memory-lifecycle.svg`.

**Simple English talk track:** “Normal conversation is not saved as durable memory. The save tool is available only after explicit intent. Memory can be updated or forgotten.”

**Demo:** Controlled memory save, new thread and forget.

**Technical evidence:** Memory lifecycle and integration tests.

**Fallback:** Memory report and diagram.

## Slide 12 — Critical LOTO Approval Requires a Human

**On-slide content**

- AI can analyze and recommend
- AI cannot approve execution
- PENDING human decision
- APPROVE resumes · REJECT stops
- Wrong-thread and double decisions are blocked

**Visual:** `diagrams/07-hitl-flow.svg`.

**Simple English talk track:** “The model does not decide whether a LOTO execution is approved. A deterministic gate creates a pending request. Only a separate human decision can approve or reject it.”

**Demo:** HITL PENDING; approve/reject only through the controlled internal path.

**Technical evidence:** HITL tests and prior controlled smoke.

**Fallback:** HITL report and diagram.

## Slide 13 — Safety Starts Before the Model

**On-slide content**

- Domain-scope enforcement
- Prompt-injection refusal
- Secret and personal-data controls
- Read-only operational tools
- Seven-field Actions allowlist

**Visual:** `screenshots/02-domain-scope-refusal.png`.

**Simple English talk track:** “The embedded agent is not a general assistant. A political question is refused before the general answer, tools, RAG or HITL. Operational Actions also use a strict seven-field output.”

**Demo:** President question.

**Technical evidence:** Scope, injection and minimization tests.

**Fallback:** Domain scope report.

## Slide 14 — The Harness Tests the Agent from Outside

**On-slide content**

- Versioned scenarios
- Normal agent execution
- Safe observable metadata
- Deterministic checks
- PASS / FAIL report

**Visual:** `diagrams/08-agent-harness.svg`.

**Simple English talk track:** “The Harness is not another agent. It sends controlled scenarios to the existing agent and checks observable results such as tools, citations, status and isolation.”

**Demo:** Show the Markdown evaluation report.

**Technical evidence:** Harness source and 5/5 focused tests.

**Fallback:** Saved evaluation artifacts.

## Slide 15 — Current Validation Is Fully Green

**On-slide content**

- Backend: 154/154
- Frontend: 7/7
- Harness tests: 5/5
- Offline scenarios: 36/36
- Live-safe: 9/9
- Database integrity: PASS

**Visual:** `diagrams/09-harness-results.svg`.

**Simple English talk track:** “All current automated tests pass. The 100 percent value is a scenario pass rate for this defined dataset. It is not a claim of general AI accuracy.”

**Demo:** None; show saved evidence.

**Technical evidence:** `reports/06-test-evidence.md`.

**Fallback:** Evaluation JSON/Markdown artifacts.

## Slide 16 — Production Hardening Is Still Required

**On-slide content**

- Authentication and RBAC
- Tenant isolation and RLS
- Verified human approver identity
- Approval expiry
- Same-thread concurrency control
- Full token, cost and trace observability

**Visual:** One clear boundary: “Validated prototype” → “Production hardening”.

**Simple English talk track:** “These are not hidden gaps. The current prototype has no authentication, user ownership or verified approver identity. These controls are required before production deployment.”

**Demo:** None.

**Technical evidence:** Sprint 6 final validation, section 14.

**Fallback:** Limitations document.

## Slide 17 — One System, Controlled Paths

**On-slide content**

- Angular → Express → LangGraph
- Domain refusal before general execution
- Tools, RAG, state, memory and HITL use controlled stores
- Verify before final delivery

**Visual:** `diagrams/01-final-architecture.svg`.

**Simple English talk track:** “This is the complete architecture. Each type of context has one job. The refusal and approval paths remain deterministic around the model.”

**Demo:** None.

**Technical evidence:** Current source and final validation matrix.

**Fallback:** Final architecture report.

## Slide 18 — A Working Agent with Defensible Evidence

**On-slide content**

- Real HSE problem
- Real Angular and PostgreSQL system
- Agentic routing and grounded RAG
- Persistent state, controlled memory and HITL
- Safety Harness and transparent limitations

**Visual:** Small strip of the UI, architecture and 36/36 result.

**Simple English talk track:** “YVY HSE now demonstrates a complete agent system. It works in the real application, uses the correct data path, refuses unsupported requests and has repeatable safety evidence. The next action is final presentation production and submission.”

**Demo:** Optional recap.

**Technical evidence:** Final validation and submission checklist.

**Fallback:** Evidence index.
