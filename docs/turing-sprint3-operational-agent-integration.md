# Sprint 4.2 — Operational Agent Integration and UI Reliability

Validation date: 2026-08-08

## 1. Problem discovered through UI testing

The real Angular widget returned `Não consegui concluir essa consulta agora.` for `Quais ações estão atrasadas?`. Backend-only tests had not exercised the complete PostgreSQL tool-result → second model-step boundary.

## 2. Root-cause audit

The UI uses `POST /api/ai/chat` and the LangGraph runner. A direct fresh-process invocation with `gpt-5.5` passes. One verified operational failure was an `INVALID_REQUEST`: PostgreSQL date/timestamp columns arrived as JavaScript `Date` objects, while AI SDK v7 requires JSON-compatible tool results before the next model step. Actions and incidents therefore failed after their read-only tool executed. That defect is fixed.

## HTTP-only failure investigation (Sprint 4.2B)

The direct runner and HTTP route resolved the same configuration: provider `openai.responses`, model `gpt-5.5`, LangGraph, five tools, streaming enabled, no configured temperature, five maximum model steps, thread persistence enabled, zero history messages, zero retrieved memories and RAG available.

The safe provider fingerprint identified the apparent HTTP-only failure as `RetryError > APICallError > AggregateError > Error`, provider code `EACCES`, stage `MODEL_STREAM`. The server process had been launched inside the execution sandbox without external-network permission, while the successful direct health request had been explicitly authorized. It was therefore an execution-environment permission mismatch, not an HTTP payload, model, tool schema, SSE, history, thread, memory, RAG or stale-dist defect.

`EACCES`/`EPERM` are now classified as `NETWORK_ERROR`. When the server process is launched with the same network permission as the direct runner, the harmless `/api/ai/chat` request completes in one step and returns a thread ID. A second harmless request with prior visible history reuses the same persisted thread and also completes.

The route now exposes an injected-dependency factory used by an actual HTTP-boundary regression test. Production defaults remain unchanged. The regression test covers LangGraph selection, model invocation, SSE, `done`, thread return/reuse and a synthetic `list_actions` two-step loop without operational data.

No API key, provider payload, SQL exception, prompt, or stack trace is sent to the browser.

## 3. UI-to-LangGraph architecture

```text
Angular widget → POST /api/ai/chat → LangGraph
  → operational query: read-only PostgreSQL/domain tool
  → procedural query: approved RAG corpus
  → verification / HITL gate → SSE response → widget
```

## 4. Thread continuity

The widget now stores `threadId` from SSE `done` metadata and includes it in subsequent requests. `conversationId` remains a backend-compatible alias. `resetConversation()` clears the active thread only when a new chat is intentionally requested.

## 5. Portuguese operational classification

The deterministic classifier normalizes accents and recognizes Portuguese action, incident and KPI/indicator variants. `Quais ações estão atrasadas?` is classified as structured operational data, so RAG is withheld.

## 6. Shared overdue rule

`backend/src/domain/actions.ts` owns the application predicate and its constant SQL equivalent:

```text
status !== "Closed"
AND target_date exists
AND target_date < current date/time
```

KPI calculation and `list_actions` reuse this meaning.

## 7. Actions tool enhancement

`list_actions` accepts typed `overdue?: boolean`. With `overdue=true`, it applies the shared rule using parameterized/read-only SQL and returns only useful operational fields: action ID, project, description, status, target date, responsible role/person field, priority, source module and calculated days overdue.

All PostgreSQL `Date` values returned by operational list tools are converted to ISO strings before entering the AI SDK model loop.

### Outbound action-data minimization — Sprint 4.2C

Operational database rows are not passed through wholesale. `projectActionForModel()` constructs a new object using this reviewed allowlist only:

| Database/tool field | Classification | Model-visible field | Default decision |
|---|---|---|---|
| `action_id` | REQUIRED_FOR_ANSWER | `actionId` | Include |
| `action_description` | REQUIRED_FOR_ANSWER | `description` | Include |
| `status` | REQUIRED_FOR_ANSWER | `status` | Include |
| `target_date` | REQUIRED_FOR_ANSWER | `targetDate` | Include as ISO or null |
| `days_overdue` | REQUIRED_FOR_ANSWER | `daysOverdue` | Include as number or null |
| `priority` | OPTIONAL | `priority` | Include for useful prioritization |
| `source_module` | OPTIONAL | `sourceModule` | Include for traceable context |
| `project` | OPTIONAL | — | Exclude from this default projection |
| `responsible_person` | PERSONAL | — | Exclude |
| `source_reference` | UNNECESSARY | — | Exclude |
| closure/evidence/comment fields | UNNECESSARY or potentially sensitive | — | Exclude |

The SQL/domain behavior remains read-only and unchanged. The outbound projection is a separate deterministic boundary. Adding a database column does not expose it automatically; a code and policy review must explicitly add it to the allowlist.

Pre-authorization audit for `Quais ações estão atrasadas?`: 8 matching rows. Only the field names and count were printed; no action descriptions or personal fields were printed during the audit.

### Authorized live operational validation — Sprint 4.2C

The user explicitly authorized one controlled external-model test of the overdue-actions scenario. The model-visible projection was restricted to `actionId`, `description`, `status`, `targetDate`, `daysOverdue`, `priority`, and `sourceModule`. Responsible-party data and all other fields remained excluded.

Verified execution evidence:

- The deterministic classifier selected structured operational data; RAG was not used.
- The independent read-only database audit found 8 overdue rows and confirmed the exact seven-field allowlist and exclusion of personal fields.
- In the isolated HTTP server process, `list_actions` executed twice but its safe egress log reported `rowCount: 0`. No operational row values crossed that process's model boundary.
- The provider request completed and the same persisted thread was reused by the authorized follow-up.
- Neither response contained known responsible-party values, responsible/contact labels, or other forbidden fields.
- Consistent with the empty tool results, the first response was non-empty but did not contain the count or recognizable authorized action content.
- The follow-up did not identify the most overdue action or its overdue-day value. The optional third question was therefore not sent.
- Public LOTO RAG and deterministic HITL regressions passed after the operational run.
- The action-table integrity hash and all operational table counts remained unchanged: 42 tables and 784 rows.

Result: **privacy/minimization PASS; routing/tool selection PASS; live operational-row delivery FAIL (0 instead of 8); same-thread continuity PASS; follow-up correctness FAIL.** Sprint 4.2C remains incomplete pending isolation of the HTTP process database-context mismatch and a newly authorized external retest.

## 8. Error handling

The widget maps stable backend codes to controlled Portuguese messages for model, tool, validation, provider and timeout failures. Unknown codes receive a generic safe message. Raw backend/provider details are never displayed.

## 9. KPI and incident tools

`get_kpi` continues to reuse `computeKpi()`. `list_incidents` remains read-only and supports recent/project-filtered records; no unverified “open incident” rule was introduced.

KPI output contains aggregate values such as incident counts, rates, action counts, training compliance and audit averages. It does not return underlying people, incident narratives or raw records and is suitable for minimized model use.

Incident egress remains unauthorized in Sprint 4.2C. The current list projection contains project code, date, type, severity and `description`; description can contain a sensitive narrative. The table also contains fields such as injured-person name, employee/contractor status, body part, medical-treatment indicator, investigation links and authority-reporting information. These fields require a separate minimization and authorization review before any real external-provider test.

## Operational egress policy

```text
RAG reference content      → approved source allowlist
Operational tool data      → minimum necessary field allowlist
Personal/sensitive fields  → excluded by default
Critical operations        → deterministic HITL
```

This rule is a required future Agent Harness safety-matrix control.

## 10. RAG and HITL separation

Operational counts, records, status and dates use tools. Procedures, LOTO, PTW, risk-assessment methodology and emergency guidance use RAG. The deterministic `LOTO_SAFETY_EXECUTION` approval gate remains unchanged and cannot auto-approve.

## 11. Validation evidence

- Fresh-process direct model request with the configured model and real LangGraph services: PASS.
- Real `/api/ai/chat` harmless model execution with correct network permission: PASS.
- Direct versus HTTP provider/model/tool configuration: MATCH.
- HTTP integration test with mocked provider and synthetic action data: PASS.
- Local real-database model-loop validation with a mocked provider: `list_actions`, `get_kpi`, and `list_incidents` all COMPLETE; RAG not used.
- PostgreSQL: 42 original HSE tables and 784 operational rows preserved.
- pgvector 0.8.6, two RAG tables, vector dimension 1536 and orphan rejection: PASS.
- Backend typecheck/build and Angular production build: PASS.
- Backend automated suite: 137/137 PASS, including the HTTP boundary tests.
- Angular production build: PASS. ChromeHeadless GPU instability is handled by the repository's `ChromeHeadlessSafe` CI launcher; frontend specs: 3/3 PASS.

## 12. Known limitation and live approval boundary

The overdue-actions scenario was sent once under explicit, field-limited authorization. Its local projection contained 8 rows, but the isolated HTTP process returned zero tool rows, so no operational row values were sent externally. No repeat external operational request is authorized by that completed test. Incident egress remains unreviewed and unauthorized.

## 13. Presentation evidence

The presentation map records the UI-discovered defect, the cross-layer correction, and the overdue-actions demo target as evidence of `Operational Data → Tools`.

## 14. Next phase

Isolate and correct the HTTP process database-context mismatch using local diagnostics and synthetic fixtures. Then obtain fresh explicit authorization before repeating a real external-provider test. Do not broaden the approved field set, and do not test incident egress without a separate minimization review and authorization.

## 15. Sprint 4.2D — HTTP database-context alignment

Sprint 4.2D used local database reads and a mocked model only. No operational rows were sent to OpenAI or another external provider.

The local auditor and the network-authorized HTTP process now resolve the same safe identity: host `localhost`, port `5432`, database `hse_app`, schema `public`, PostgreSQL user `postgres`, PostgreSQL 16.14, search path `"$user", public`, and SSL not requested. `action_tracker_capa` exists only in `public` and resolves unambiguously to that table. Both contexts report 9 total actions and 8 overdue actions.

The historic zero-row execution did not record its complete tool arguments. Sprint 4.2E later reproduced the result with complete safe telemetry and established that it was not a database/schema mismatch: the model supplied the portfolio wildcard `project="*"`, which `list_actions` incorrectly treated as a literal project code. Two ambiguity sources were removed in Sprint 4.2D:

- The pool now imports deterministic environment bootstrap itself and fails closed when `DATABASE_URL` is missing; the silent fallback database was removed.
- Safe egress telemetry now records the complete non-sensitive filter shape (`overdue`, project-filter presence, status filter and limit), row count, allowlist and personal-field exclusion.

A real local HTTP request using LangGraph, the scripted mock model, the production `list_actions` tool and the real read-only PostgreSQL pool completed with `{ overdue: true }`. It applied no project or status filter and returned 8 minimized rows at the tool boundary. The model-visible fields remain exactly `actionId`, `description`, `status`, `targetDate`, `daysOverdue`, `priority`, and `sourceModule`.

The normal sandbox process reports `Europe/Lisbon`; the network-authorized process reports `Europe/London`. PostgreSQL reports `UTC` in both contexts, and both return the same overdue count. No timezone defect was found and the overdue rule was not changed.

Database integrity after validation: 42 operational tables and 784 operational rows preserved; no schema migration and no action update. Status: **READY FOR FINAL AUTHORIZED VALIDATION**, subject to fresh explicit user authorization.

## 16. Sprint 4.2E — final authorized operational validation

The user granted fresh authorization for one real external-model validation of `Quais ações estão atrasadas?`, limited to the seven approved fields. The pre-egress audit passed with 8 rows and no personal, responsible-party, incident, or unexpected fields.

The real HTTP/LangGraph execution selected structured operational routing, excluded RAG, invoked `list_actions`, returned a thread ID, and completed without controlled errors. Safe telemetry revealed the decisive defect: the model supplied `overdue=true`, `project="*"`, a blank status, and limit 20. The tool applied `project = '*'` literally and returned zero rows. The same-thread follow-up repeated the wildcard pattern with limit 50 and also returned zero rows. Consequently, no operational rows were sent externally, the final answer contained no real action data, and the optional third follow-up was not run.

The wildcard defect was corrected locally after the authorized execution: `project="*"` now means the whole portfolio and blank status means no status filter. An HTTP/LangGraph regression with a scripted model reproduces the observed argument shape and verifies that neither predicate is added. No second external operational call was made; fresh authorization is required to validate the correction with the real model.

Post-run controls passed: LOTO RAG retrieval, deterministic HITL, thread continuity, personal-data exclusion, and database integrity. The 42 operational tables, 784 operational rows, action hash, and operational counts remained unchanged.

### Final authorized retest

A fresh authorization was granted for one initial query plus one same-thread follow-up. Safe telemetry captured the real argument shape on both calls: the model supplied the portfolio wildcard, blank status, `overdue=true`, and limits 20 then 50. The corrected tool normalized the wildcard and blank status without adding project or status predicates. Both calls returned 8 real PostgreSQL rows through the exact seven-field projection; RAG remained unused.

The initial response reported the real count and matched all 8 authorized action rows. The follow-up reused the returned thread ID and correctly identified the action with the greatest `daysOverdue`, including the verified overdue-day value. No responsible-party value, personal/contact data, incident data, or unauthorized database field was present. A conservative text scan matched the generic word `evidence`, but the egress projection and field-specific inspection prove that no evidence field or evidence content was sent; this was a lexical false positive.

LOTO RAG, HITL, thread-state, memory, pgvector, backend/frontend production builds and automated regressions passed. Final totals: backend 145/145 and frontend 3/3. The database remained read-only with 42 operational tables, 784 operational rows and an unchanged action-table hash. Sprint 4.2 and the operational validation are **COMPLETE**.
