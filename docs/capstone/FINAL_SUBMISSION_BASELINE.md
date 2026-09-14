# Final submission baseline

Date: 2026-09-14. Branch: `capstone/yvy-hse`. Runtime commit: `f9b58d0`.
The submission HEAD is the documentation commit containing this report; resolve it with
`git log -1 --format=%H -- docs/capstone/FINAL_SUBMISSION_BASELINE.md`.
Feature freeze: no new agent capability, RAG source or demonstration step.
Showcase: **PENDING USER SUBMISSION**. A timed continuous rehearsal and Gilvan's oral defence remain user actions.

## Scope and preservation

The submitted runtime includes the verified incident count contract/fallback, evidence facts,
canonical Overview/Evidence presentation, independent cards, current RAG demo question,
Command Center lifecycle/adaptive layout, safe Markdown and playback-driven voice state.
Existing source permissions, retrieval/RRF/citations and HITL ownership remain authoritative.

Record drafts, record review, generic record creation, assistant page context and expanded
automatic app-data routing are **EXCLUDED**: none is required by the six-step Capstone.
Their local files were backed up before removing imports and source/test discovery dependencies.
The existing committed read-only `list_app_modules` / `query_app_records` tools remain;
no draft route, tool or migration is part of this baseline. Migration number 012 is intentionally absent.
Local historical evaluation files are not runtime dependencies. No `.env`, credentials, dumps or uploads are submitted.

## Fixes and evidence

- `735cbce`: normalize absent legacy `toolsUsed`/citations; reject malformed supplied collections/identity.
  The regression persists the incomplete Pending Approvals snapshot, resets TestBed, then renders Command Center.
  This removes the formerly reproduced 22 order-dependent failures rather than relying on suite order.
- `7b1c491`: migration 014 audits active duplicate groups under a table lock, creates user-scoped
  content uniqueness, preserves unowned historical rows separately, then drops the global index.
  The demo migration bootstrap now uses a transaction per migration, like the standard runner.
  Existing demo audit: one active unowned row, zero duplicate groups; one row preserved after migration.
- `f9b58d0`: selected existing runtime corrections, optional-feature separation and portable screenshot output.
  Historical Sprint I provenance retains a local-only archive description without a machine path.

## Validation boundaries

| Gate | Consolidated source result |
|---|---|
| Backend tests | 449/449 |
| Frontend full suite, two executions | 262/262 each |
| Backend and frontend app/spec typechecks | PASS |
| Backend and frontend builds | PASS; existing warning budgets remain |
| Demo safety tests | 14/14 |
| Agent offline / supplementary | 44/44 / 3/3 |
| Intent | 134/134 |
| Hermetic agent evaluation | Socket/fetch blocked; fake model and operational DB |
| Memory PostgreSQL regression | Two users save the same content; same-user duplicate UNCHANGED; key conflict CONFLICT; isolated forget/reactivation |
| Empty PostgreSQL setup | Base schema plus all committed migrations, then synthetic demo seed |

The final documentation commit must also pass these checks in a new worktree installed from lockfiles,
with no copied source or `.env`. The final execution report identifies that exact HEAD and its fresh results.
Build outputs/logs are generated locally and are not required source files.

## Prompt and retrieval identity

Prompt version: `agent-g-v1`; fingerprint: `9105843caf313fe5e749bb34df5ddfa9b5f75dcb58fc181a8270b2fd5cb91948`.
The content fingerprint changes because the incident totals policy is now submitted; the draft policy is excluded.
Corpus fingerprint: `cd19ac92e204c7f9e7ee59bec8af925ad8cbd898b271a765d782a32a3dc4f6a1`.
Four approved documents; embeddings `text-embedding-3-small`, 1536 dimensions; threshold 0.45; ANN deferred.

Current dataset: 24 queries, EN16/PT8. Hybrid RRF required/relevant recall 1, irrelevant retrieval rate 0,
MRR 1, top-1 1. Semantic-only required/relevant recall 0.666667, irrelevant rate 0, MRR/top-1 0.636364.
Replay uses production retrieval and real PostgreSQL with verified retained vectors; it is not live generation quality.
No paid embedding call is needed for the retained-corpus validation. A fresh ingest can use those exact public
retained vectors through the ingestion service; it must verify content/config identity and never copy a demo database.

## Canonical application behavior

Attention and pending-approval chat use `PostgresApprovalService.listPending()` with live owner/project checks.
These deterministic API/service reads are real operations, not LLM-selected LangGraph tool calls.
Zero matching records is distinct from infrastructure failure. Business Evidence View omits raw internals;
Inspector retains sanitized technical diagnostics.

The Demo orchestrator only coordinates Introduction, Tool Calling, RAG + Citation, Memory, Human Approval, Closing.
A current PENDING request blocks Continue until a correlated human decision. Historical decisions do not complete
new sessions. Restart resets presentation state without resolving approval; Skip preserves PENDING.
Finish presentation reaches COMPLETED and freezes elapsed time, retaining truthful skipped/warning outcomes.
Prior browser HITL and terminal acceptance are recorded in the linked validation documents; they are not proof
of a continuous six-step 8:30-9:30 rehearsal. Voice failure does not block text execution.

## Reproduction

Install with `npm.cmd ci` in backend, frontend and database. Run backend `npm.cmd test`,
`npm.cmd run typecheck`, `npm.cmd run build`; frontend `npm.cmd run test:ci` twice,
`npx.cmd tsc -p tsconfig.app.json --noEmit`, `npx.cmd tsc -p tsconfig.spec.json --noEmit`, `npm.cmd run build`.
Offline agent CLI: `npm.cmd run eval:offline` (writes evaluation artifacts; no provider keys required).
Retrieval replay: `node --require ts-node/register/transpile-only src/ai/rag/multilingual.cli.ts
--run-dir ../artifacts/evaluation/f2-multilingual --profile after-final-replay` from backend,
with a legitimate DATABASE_URL; use a unique profile. The command rejects changed cache/corpus identity.

For an empty disposable PostgreSQL/pgvector server, create `hse_app_demo`, apply `database/schema.sql`,
then run `database/migrate.js` with DATABASE_URL. Alternatively the existing demo schema bootstrap applies
that same schema/migration set. Run the existing synthetic demo seed only on the empty disposable database.
Do not reset the working rehearsal database to prove fresh installation.

The memory integration CLI is deliberately restricted to `127.0.0.1:55432/hse_app_demo`:
set MEMORY_VALIDATION_DATABASE_URL for that disposable server, then run
`node --require ts-node/register/transpile-only src/ai/memory/memory-isolation.integration.cli.ts`.
Fixtures roll back. The demo dataset has 3 projects, 12 actions, 8 overdue, 5 incidents before account scoping.
Provision a synthetic account using the existing auth CLI and a locally chosen password; do not record it here.

Demo process configuration: AI_ORCHESTRATOR=langgraph, TURING_DEMO_MODE=true,
TURING_DEMO_SAFE_DATA=true, TURING_DEMO_PROJECT=DEMO-LIS-01 and the dedicated demo DATABASE_URL.
Use an account authorized for synthetic data, a configured model, and optional ElevenLabs/browser voice.
No production persistent value needs changing. Open the frontend and run preflight only for smoke acceptance.

## Remaining / feature freeze

- USER ACTION REQUIRED: continuous timed rehearsal, manual HITL decision, oral ownership, real Showcase and README URL.
- DOCUMENTED LIMITATION: four-document corpus, bounded evaluations, browser STT, digital approval without equipment-level certification,
  finite injection/semantic controls, no complete live answer-quality benchmark and no institutional reviewer sign-off.
- FUTURE PRODUCT HARDENING: thread compare-and-swap (version increments are not conflict protection), retention/purge,
  resource reassignment transactions, production load/security assessment and full-duplex voice.
- Presentation warning: some Voice Settings labels are still Portuguese; this sprint does not introduce aesthetic UX changes.

Agent feature freeze: YES. Demo feature freeze: YES. No seventh step or new capability is required.
