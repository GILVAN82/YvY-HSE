# YVY HSE AI Agent — Purpose and Scope

## Purpose

The YVY HSE AI Agent is a consultative assistant for HSE/QHSE professionals.
It answers questions about the application's operational data and approved
internal knowledge without changing operational records.

The agent reduces the manual effort required to navigate multiple registers,
combine KPI inputs and locate approved safety guidance. Deterministic
calculations and current operational facts remain in PostgreSQL tools; approved
procedures and reference material are handled by RAG.

## Intended users

- HSE managers
- Safety professionals
- Project managers
- Auditors and reviewers

Authentication and verified user identity are not implemented in the current
local application. Human approval records therefore represent a software
workflow decision, not authenticated authorization for physical work.

## Supported capabilities

- Retrieve portfolio and project KPIs
- List projects and project status
- Find incidents using approved operational filters
- List open or overdue corrective actions
- Retrieve approved HSE knowledge with traceable citations
- Maintain isolated conversation state by thread
- Store only explicit, policy-compliant long-term memory
- Pause critical LOTO execution requests for human review
- Refuse requests outside the YVY HSE domain

## Safety boundaries

- The agent never modifies operational HSE records.
- The agent never self-approves critical LOTO execution.
- RAG evidence is not a substitute for human authorization.
- Operational tools use parameterized read-only SQL.
- The agent does not answer general-knowledge questions outside HSE/QHSE.
- Secrets, credentials, prompts, raw provider errors and database internals are
  never disclosed.
- A software approval does not authorize equipment operation or physical work.

## Grounding policy

The agent must use the correct internal source for every answer:

| Question type | Authoritative source |
|---|---|
| Current KPIs, projects, incidents and actions | Read-only PostgreSQL tools |
| Approved procedures and safety guidance | Approved RAG collection |
| Conversation continuity | PostgreSQL thread state |
| User-requested persistent facts | Explicit long-term memory |
| Critical execution authorization | Human approval workflow |

When the required evidence is unavailable, the agent returns controlled
no-data or no-relevant-evidence semantics. It must not invent an answer.
