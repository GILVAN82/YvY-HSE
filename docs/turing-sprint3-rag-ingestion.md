# Sprint 3 — Controlled RAG ingestion

## 1. Objective

Implement an explicit, traceable and idempotent pipeline from an approved source through
normalization, chunking, SHA-256 hashing, OpenAI embedding and transactional pgvector storage.
This sprint builds ingestion capability only; it adds no retrieval, API, LangGraph or UI path.

## 2. Source classification

The requested `docs/turing-sprint3-agentic-rag-audit.md` does not exist. Its authoritative
material is the existing `docs/turing-sprint3-rag-audit/` report set, especially the executive
summary, SQL-vs-RAG classification, collection analysis, privacy findings and backlog.

That audit concludes that the current application has no defensible RAG knowledge documents:

- Approximately 90 structured fields require exact SQL/tool access.
- Operational narratives are short database records, not reusable procedures or guidance.
- UI descriptions are prompt material, not HSE knowledge.
- ERP, SDS/MSDS, LOTO, audit protocol and controlled-document references do not include their
  actual document bodies.
- Several operational sources contain fields explicitly classified `EXCLUDE`.

The implementation preserves that conclusion. It does not reinterpret `RAG CANDIDATE` text
fields as approval to embed their full operational records.

## 3. RAG source allowlist

`RAG_SOURCE_REGISTRY` is the sole ingestion allowlist. It contains four enabled, reviewed
internal curated summaries. Each entry declares source type/reference, module, title, version,
public-reference sensitivity and an exact file path. There is no crawler, project scan or
database-wide text scan.

The separate exclusion registry contains 18 audited source groups. Its classifications are
`TOOL_SQL`, `PROMPT`, `DO_NOT_EXPOSE` and `MISSING_DOCUMENT`.

## 4. Excluded structured sources

Operational tables remain under SQL/tools: emergency scenarios/drills, HIRA, JSA, incidents,
CAPA, observations, toolbox registers, meetings, MOC, spills, chemical inventory, legal and
audit status, document control metadata and change history. Exact status, counts, dates,
measurements and record filtering must never depend on vector similarity.

The production exclusion registry reports 18 groups, including nine groups with personal,
medical, confidential or identity-bearing fields. No raw database row is loaded or embedded.

## 5. Security and data minimization

- Only `public-reference` sources are accepted.
- Document metadata is limited to `sensitivity` and optional `language`.
- Chunk metadata contains only the documented token-estimation method and an optional boolean
  injection-content flag.
- Names, phones, medical fields, credentials, connection strings, secrets and raw source records
  are never copied automatically.
- The OpenAI key is read only from `OPENAI_API_KEY`; it is not logged or persisted.
- The existing lack of authentication, RBAC, tenant isolation and row-level security remains a
  blocker for confidential or multi-company content.

## 6. Normalization

Normalization is local and deterministic: CRLF/CR becomes LF, repeated horizontal whitespace is
collapsed, line edges are trimmed, three or more newlines become one paragraph boundary, and
outer whitespace is removed. Headings and paragraph breaks are preserved. No LLM cleans,
rewrites or summarizes source content.

## 7. Chunking strategy

Short sources at or below the approximate 1,000-token maximum stay in one chunk. Longer sources
split first on paragraphs and preserve complete sections where possible. Targets are 750 tokens,
maximum approximately 1,000, and overlap approximately 100. Without a tokenizer dependency,
token counts use the deterministic approximation `ceil(characters / 4)` and record that method
in chunk metadata. Chunks are created independently per document and never cross sources.

## 8. Hash and idempotency strategy

SHA-256 is calculated over normalized UTF-8 content:

- New source: embed chunks and create document/chunks.
- Same source and hash: skip without calling OpenAI.
- Changed hash: embed first, then replace document metadata and chunks in one transaction.
- Disabled/removed source: retain historical rows; automatic deletion is deliberately absent.

The database uniqueness constraints and transactional replacement prevent duplicate positions
or half-indexed updates. Embedding failure occurs before persistence and leaves existing rows
unchanged.

## 9. Embedding model and configuration

The isolated `OpenAIEmbeddingService` uses the already-installed official `@ai-sdk/openai`
provider with AI SDK `embedMany`; no new dependency was required. Model and dimensions come from
`backend/src/ai/embedding.config.ts`:

```text
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

Every returned vector is checked for exactly 1,536 finite numbers before persistence.

## 10. PostgreSQL persistence

`PostgresRagRepository` uses the existing `pg` pool and parameterized SQL. It finds a document
by source type/reference, counts indexed rows, and creates or replaces documents and chunks.
Vector values are supplied as a bound parameter cast to `vector`; untrusted values never alter
SQL structure.

## 11. Failure and transaction behavior

Normalization, chunking and all embeddings finish before a write transaction starts. Document
update, old-chunk deletion and all new-chunk inserts then commit together. Any failure rolls the
transaction back. Per-source errors are returned without logging source bodies.

## 12. Prompt-injection considerations

Indexed text is untrusted data. The pipeline flags phrases resembling instruction override,
system/developer prompt access, secret disclosure or command execution. It records only a
boolean on affected chunks and a source-reference warning; it neither deletes nor executes the
content. Strong instruction/data separation remains retrieval work for Sprint 2.2C.

## 13. Dry-run workflow

```powershell
cd backend
npm run rag:ingest -- --dry-run
```

Dry-run loads only allowlisted sources and reports titles, modules, sizes, chunks, hashes and
sensitivity. It does not instantiate a network request, query/write RAG state, or call OpenAI.
The verified 2026-08-08 run examined four approved sources, planned one chunk per source, reported
no invalid/sensitive/injection-warning results and left database counts unchanged at zero
documents and zero chunks.

## 14. Live ingestion workflow

Live ingestion is an intentional administrative command and never runs at backend startup:

```powershell
cd backend
npm run rag:ingest
```

Configure `OPENAI_API_KEY` only in `backend/.env` or the backend process environment. Review the
registry and dry-run first. On 2026-08-08 the four-source dry-run and a one-string, non-persisted
OpenAI health check passed; the returned vector had exactly 1,536 dimensions. Live ingestion then
created four documents, four chunks and four embeddings through the normal transactional path.

Local environment loading is centralized in `backend/src/config/env.bootstrap.ts`. It resolves
`backend/.env` from the backend module location rather than `process.cwd()`, so server startup,
compiled execution and `npm run rag:ingest` share one deterministic path. An existing process
environment value takes precedence; the local file fills only missing values. Tests inject fake
values into isolated environment objects and never read or require a real key. Configuration
errors report only that the provider is not configured and never echo secret material.
An injected empty or whitespace-only process value is treated as absent, allowing a valid local
fallback; only a non-empty injected value overrides the file.

## 15. Tests

- Focused RAG tests: 28/28 passed, including the four-source production validation.
- Backend complete suite: 75/75 passed.
- Typecheck/build: PASS.
- pgvector infrastructure validation: PASS.
- Dry-run database comparison: `0|0` before and after, passed.

Automated tests use an injected mock embedding service and never require OpenAI.

## 16. Actual indexed corpus statistics

| Metric | Value |
|---|---:|
| Approved production sources | 4 |
| Excluded audited source groups | 18 |
| Sensitive source groups excluded | 9 |
| `rag_documents` | 4 |
| `rag_chunks` | 4 |
| Stored embeddings | 4 |
| Invalid vector dimensions | 0 |
| Duplicates | 0 |
| Orphans | 0 |

A small truthful empty index is preferable to fabricated HSE knowledge or embedding operational
records merely to demonstrate RAG.

## 17. Known limitations

There is no approved documentary corpus, OpenAI key, authentication/RBAC, tenant isolation,
retrieval, citation rendering, evaluation set, file upload, document parser or RAG API. The
character-based token count is estimated. A future source loader needs explicit sensitivity and
field review before registry approval.

## 18. Files created or modified

Created: `backend/src/ai/rag/{types,sourceRegistry,textProcessing,embedding.service,
rag.repository,ingestion.service,ingest.cli}.ts`, focused RAG tests, and this document.
Modified: `backend/package.json` and `docs/architecture.md`.

## 19. Next step

Obtain real approved HSE procedure/policy/document bodies and implement controlled document
storage plus access control. Once a source passes sensitivity review, add one explicit loader,
run dry-run and tests, then perform the first live embedding. Retrieval and LangGraph integration
remain Sprint 2.2C work after a real corpus exists.

## 20. Approved Knowledge Source Onboarding

Real source files have a controlled staging location at `knowledge/approved/`. A file in that
directory is inert until an explicit `RAG_SOURCE_REGISTRY` manifest entry enables it. The loader
does not enumerate or recursively scan the directory, so unregistered files are ignored.

Each manifest entry requires a stable source ID (stored as `source_reference`), title, HSE
module, source type, version, relative `.md`/`.txt` path, sensitivity, enabled state and citation
label. Real effective/revision dates and language are optional. The relative path and citation
label are stored as minimized traceability metadata; the source ID, type, module, title, version
and content hash remain first-class document fields.

Before approval, the loader verifies the manifest, unique source ID, path containment, supported
extension, file existence and non-empty normalized content. Non-`public-reference` documents and
content matching personal-data, credential, environment-variable or connection-string patterns
are blocked. Instruction-like text is retained but reported under `PROMPT-INJECTION WARNING`.
Disabled entries appear as `EXCLUDED`; malformed entries appear as `INVALID`.

The temporary authorization boundary remains strict: until authentication, RBAC, tenant
isolation and row-level security exist, only non-sensitive internal HSE reference knowledge can
be enabled. Operational records stay in SQL/tools, agent rules stay in prompts, and confidential
or personal material stays outside the index. See `knowledge/README.md` for the reviewer workflow.

## 21. First real YVY HSE knowledge corpus

Four English, public-reference, internal curated summaries were reviewed and registered on
2026-08-08:

| Source ID | Module | Provenance | Jurisdiction | Planned chunks |
|---|---|---|---|---:|
| `yvy-kb-loto-osha-1910-147` | LOTO | YvY summary based on OSHA 29 CFR 1910.147 and OSHA training guidance | United States — Federal General Industry | 1 |
| `yvy-kb-ptw-hse-hsg250` | Permit to Work | YvY summary based on UK HSE HSG250 and HSE COSHH guidance | United Kingdom | 1 |
| `yvy-kb-risk-assessment-hse` | HIRA / Risk Assessment | YvY summary based on UK HSE risk guidance | United Kingdom | 1 |
| `yvy-kb-emergency-procedures-hse` | Emergency Preparedness and Response | YvY summary based on UK HSE emergency-procedure guidance | United Kingdom | 1 |

All four are `RAG_APPROVED`: they contain reusable reference knowledge, not operational rows,
personal/medical information, secrets or confidential narratives. No prompt-injection-like text
was detected. Registry metadata explicitly records `curated_summary_not_official_text`, source
organization, official reference URL, jurisdiction, citation label and access date, so citations
cannot misrepresent these files as original OSHA/HSE publications.

Dry-run hashes and approximate chunk sizes were reviewed without copying full document content
into this documentation. Planned chunk token estimates are 648 (LOTO), 572 (PTW), 600 (risk
assessment) and 538 (emergency procedures): four chunks total, minimum 538, maximum 648 and
average 589.5. Each short document remains one semantic chunk.

Embedding configuration remains `text-embedding-3-small` with 1,536 dimensions. The first live
run created 4 documents, 4 chunks and 4 embeddings. The unchanged second run created 0, updated
0, skipped 4 and generated 0 embeddings; database counts remained 4/4, proving idempotency.
Traceability from every chunk through document, source file, citation label, organization,
jurisdiction, official reference URL and SHA-256 content hash passed. pgvector validation,
typecheck, production build and all 75 automated tests passed. The original 42 HSE tables and
784 operational rows remained unchanged.

OSHA/HSE reference knowledge is jurisdiction-specific and must not be presented as automatically
legally applicable to every site or country.
