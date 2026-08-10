# Sprint 3.2 — Controlled long-term memory

## 1. Objective

Provide explicit, minimal, traceable, removable application-level context that can be reused across independent conversation threads. Normal chat is never automatically promoted to durable memory.

## 2. Thread state versus long-term memory

Thread state remains a bounded 30-message conversation checkpoint in `agent_thread_state`. Long-term memory stores only approved durable concepts in `agent_long_term_memory`. RAG remains authoritative external HSE reference knowledge. These stores are separate.

## 3. Memory policy and allowed categories

A write requires explicit user intent such as “remember that” or “use this in future conversations.” The allowlist is:

- `WORKFLOW_PREFERENCE`
- `PROJECT_CONTEXT`
- `OPERATING_CONSTRAINT`
- `DOMAIN_PREFERENCE`

Candidates must be reusable, durable, non-empty, no more than 500 characters, and represented by a stable internal key. At most 50 active memories are allowed.

## 4. Prohibited content

The validator rejects secrets, credentials, database URLs, personal/medical worker data, investigation identities, numbered transient operational records, prompt-injection authority, oversize content, unknown categories, and invalid keys. Full messages, transcripts, RAG chunks, SQL results, embeddings, prompts, and environment values are never part of the memory schema.

## 5. PostgreSQL schema

Migration `003_create_agent_long_term_memory.sql` adds an isolated table with UUID ID, unique internal `memory_key`, allowlisted category, normalized content, SHA-256 content hash, enabled flag, timestamps, and last-used timestamp. It adds no user or tenant identity because the application has no authenticated ownership model.

## 6. Write flow

The runner deterministically detects explicit intent. Only then is `save_memory` included in the model toolset. The tool uses a strict Zod schema and `ControlledMemoryService`; SQL remains parameterized. Normal statements never expose the write tool.

## 7. Retrieval flow

Before agent execution, active memories are ranked by deterministic token overlap across key, category, and content. A small English/Portuguese alias map handles database/persistence terminology. At most three relevant items are returned. No vectors or additional embedding store are used.

Relevant memories are appended below the system policy inside `<long_term_memory>` delimiters and explicitly marked as untrusted contextual data, never instructions.

## 8. Idempotency and update semantics

Normalized lowercase content is SHA-256 hashed. The same category/content returns `UNCHANGED` and creates no duplicate. A changed value for an existing key returns `CONFLICT` unless the user/model explicitly sets `update=true`; explicit updates preserve the stable row identity.

## 9. Forget/delete lifecycle

`forget(memoryKey)` disables an active item so retrieval immediately stops returning it. It is internal/testable and is not exposed as a public unauthenticated endpoint. The smoke CLI hard-deletes its own known temporary test row after verification.

## 10. Prompt-injection defense

Injection-like candidates are rejected before persistence. Retrieved memory is labeled untrusted and placed beneath the immutable system policy. It cannot grant tool access or override system, safety, RAG, or operational-data rules.

## 11. RAG and operational-data separation

RAG chunks and citations are not copied into long-term memory. Incident status, permit expiry, action records, KPIs, and similar current facts remain in PostgreSQL operational tables and SQL tools. Long-term memory is not a cache or substitute for those systems.

## 12. Failure recovery

Repository operations are atomic. A failed memory write creates no row; the tool converts the failure into a controlled result. Thread checkpoints, RAG, and prior memories remain unchanged. Memory retrieval is optional context and fails open with a metadata-only warning, so the agent and RAG remain usable without uncertain memory.

## 13. Security limitations

The scope is application/project-level, not per-user. The system lacks authentication, ownership, RBAC, tenant isolation, and row-level security. UUIDs and memory keys are not authorization. Public memory listing/deletion APIs were deliberately not added.

## 14. Automated tests

Tests cover explicit save, no automatic save, secret/sensitive rejection, duplicate control, explicit update, forget, cross-thread retrieval, unrelated-memory exclusion, transcript/RAG/vector exclusion, prompt-injection handling, write failure, size limits, and agent tool gating. Existing thread, RAG, guard, and ingestion suites remain enabled.

Final validation: migration PASS; TypeScript typecheck PASS; production build PASS; complete suite 107/107 PASS; pgvector validation PASS (0.8.6, 1536 dimensions). Database verification found 42 operational tables, 784 operational rows, 4 RAG documents, 4 RAG chunks, zero temporary thread rows, and zero smoke-test memory rows.

## 15. Live smoke test

With OpenAI configured, Thread A explicitly saved that PostgreSQL is the YVY HSE persistence database. Thread B was new and received the relevant application memory without Thread A messages; its answer used PostgreSQL. The memory was forgotten, Thread C received zero matching memories, and the smoke row and three temporary thread rows were deleted afterward.

## 16. Known limitations

- Relevance is lightweight lexical matching, appropriate only for the small capped memory set.
- Memory is global to this application instance/database.
- There is no authenticated consent/ownership UI.
- Concurrent updates to the same key use normal PostgreSQL last-write behavior.
- Disabled production memories require an internal administrative process for hard deletion.

## 17. Next phase

Recommended next step: **Sprint 4.1 — Human-in-the-Loop**, without expanding automatic memory extraction.
