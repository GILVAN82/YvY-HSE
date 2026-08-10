# YVY HSE — Final Reviewer Q&A

## Why LangGraph?

**Short answer:** It makes routing, refusal, verification and human approval explicit.

**Detailed answer:** LangGraph owns typed states and conditional edges. The AI SDK remains responsible for streaming and tool calling inside the agent node. This separation makes safety transitions testable without asking the model to enforce them.

## Why PostgreSQL?

**Short answer:** The application already uses PostgreSQL for exact HSE data and durable state.

**Detailed answer:** Operational data, RAG metadata/vectors, thread state, controlled memory and HITL audit records can remain in one transactional database while staying in separate tables and access paths.

## Why pgvector?

**Short answer:** It adds vector similarity to the existing PostgreSQL database.

**Detailed answer:** The project needs a small controlled corpus, not a separate vector platform. pgvector supports parameterized cosine retrieval with the same backup and integrity model as the application database.

## Why only four RAG documents?

**Short answer:** Quality and approval boundaries matter more than corpus size.

**Detailed answer:** The four curated summaries cover LOTO, PTW, risk assessment and emergency procedures. Other repository data is structured, sensitive or lacks an approved document body, so it is intentionally excluded.

## Why Tools for operational data?

**Short answer:** Current counts, dates and statuses require exact SQL results.

**Detailed answer:** Similarity search is not authoritative for “how many” or “which actions are overdue”. Typed tools query PostgreSQL directly and return controlled outputs.

## Why not embed all database rows?

**Short answer:** It would reduce accuracy, freshness and privacy.

**Detailed answer:** Operational rows change and may contain personal fields. SQL preserves exact semantics and current values. RAG remains for reusable unstructured guidance.

## What is RAG?

**Short answer:** Retrieval-Augmented Generation gives the model relevant approved evidence before it answers.

**Detailed answer:** The question is embedded, pgvector retrieves similar approved chunks, and the agent uses that evidence with citations. Retrieved text is treated as untrusted data.

## What is Thread State?

**Short answer:** It is the bounded context of one conversation.

**Detailed answer:** A stable UUID loads up to 30 recent messages from PostgreSQL. Separate UUIDs stay isolated. It is not durable cross-thread preference memory.

## What is Long-Term Memory?

**Short answer:** It is explicit reusable project context across new threads.

**Detailed answer:** Only “remember” intent exposes the save tool. Allowed categories, content limits, secret/personal-data rejection, idempotency, update and Forget are enforced.

## How does HITL work?

**Short answer:** A critical LOTO approval pauses for a separate human decision.

**Detailed answer:** After verification, the deterministic gate creates a PENDING record. APPROVE or REJECT must match the approval and thread and can run only once.

## Can AI approve LOTO by itself?

**Short answer:** No.

**Detailed answer:** Model text, RAG evidence, memory and prompt injection cannot resolve the pending approval. Only the controlled human decision path can do that.

## Why is the agent domain restricted?

**Short answer:** It is an embedded HSE specialist, not a general assistant.

**Detailed answer:** Restriction reduces unsupported answers and unnecessary model/tool access. General knowledge is refused before normal execution.

## How do you prevent prompt injection?

**Short answer:** The Guard blocks known direct attacks, and retrieved data cannot grant authority.

**Detailed answer:** Input patterns stop common system-prompt, secret and persona attacks. RAG and memory are delimited as untrusted context. Tools are typed and operational tools are read-only.

## How do you prevent false citations?

**Short answer:** A citation must match evidence returned in the current run.

**Detailed answer:** The verifier checks labels against retrieved evidence. Missing or invented citations fail deterministic grounding validation.

## What happens when no evidence exists?

**Short answer:** The agent states the evidence gap and gives no citation.

**Detailed answer:** Evidence below the similarity threshold is excluded. The no-evidence path and tests prevent fabricated source claims.

## How is operational personal data protected?

**Short answer:** Actions use an exact seven-field allowlist.

**Detailed answer:** Only ID, description, status, target date, days overdue, priority and source module reach the model. Responsible-person, verifier and unexpected fields are excluded constructively.

## Why is human approver identity not verified?

**Short answer:** The prototype has no authentication or RBAC.

**Detailed answer:** Recording an approver identity would falsely imply verification. Production requires authenticated users, roles, ownership and stronger audit controls.

## What does 100% scenario pass rate mean?

**Short answer:** All 36 defined offline scenarios passed their deterministic checks.

**Detailed answer:** It measures this versioned evaluation dataset. It is not general AI accuracy, universal correctness or a statistical quality benchmark.

## What did real UI testing discover?

**Short answer:** It found integration defects that isolated backend tests did not show.

**Detailed answer:** Real tests exposed frontend thread-ID reuse, runtime network/provider context, wildcard filtering, database-context alignment, provider availability/CORS behavior and general-knowledge scope leakage. Each correction gained regression evidence.

## What is required before production deployment?

**Short answer:** Authentication, authorization, isolation and operational governance.

**Detailed answer:** The final list includes authentication, RBAC, tenant isolation, RLS, verified approver identity, approval expiry, same-thread concurrency control, native durable workflow semantics where needed, and full token/cost/trace observability.
