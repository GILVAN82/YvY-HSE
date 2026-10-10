# Pending approvals and Operational Attention

## Root cause and correction

See [the investigation recorded before the change](pending-approvals-root-cause.md). The request had no pending-list intent/tool; the generic agent registry and generic LOTO authorization error were inappropriate for this read. The new bounded EN/PT/ES/FR/DE intent is `LIST_PENDING_APPROVALS`. Compound execution directives retain the critical routing policy.

`list_pending_approvals` is a deterministic read operation in the canonical chat endpoint, before model selection. It invokes `PostgresApprovalService.listPending`, which is also used by the Attention evaluator. It does not run actions, incidents, KPI, generic application tables, retrieval, approval creation or approval resolution. This path works for normal use and Demo Mode, with no demo switch or hardcoded project/count.

## Authorization and scope

The read requires AI_USE and HSE_DATA_READ. It intersects principal scope with live database membership, requires an active owner, matching requester and owned conversation, nonempty approval project scope, and existing projects. Every project of a multi-project approval must be authorized. Empty principal allowlists return no rows. ADMIN behavior follows the existing policy and is independently constrained by the live database role/membership checks.

An explicit project/screen filter is only a selection hint, checked against the principal and the live repository query. With no filter, the query covers the authorized portfolio. Missing permission and out-of-scope selection have distinct controlled errors. A valid empty read is `SUCCESS_NO_DATA` (client `NO_DATA`), not an authorization error. Historical APPROVED, REJECTED and CANCELLED rows are excluded.

## Business presentation and Inspector

The response counts approvals independently from Attention's mixed alert count. Each approval has its own canonical Attention card and EvidenceView. Review approval selects the exact returned reference and original thread; decisions still use the existing authorized, single-use HITL endpoint. No decision is made by the listing tool. Decision responses update the selected card, other references to the same approval, and active Attention counts.

The decision basis names the human approval register, verifies the recorded status and project scope, and explicitly excludes physical isolation, field conditions and authorization of work. A status-only listing does not claim a RAG outage. Technical IDs remain outside business text. Inspector shows the explicit intent, one tool, safe scope label, result count and the linked HITL state.

## Browser validation

On localhost:4300, authenticated as YvY HSE Demo Presenter, using hse_app_demo and DEMO-LIS-01:

- The initial pending query returned “1 approval is awaiting your decision.”, the LOTO card and both required CTAs. No permission/project error or unrelated empty cards appeared.
- The existing approval was subsequently approved through the browser; Codex did not click Approve or Reject. The returned human-decision message, historical card status and database state agreed. Attention reduced to four active items and two high items.
- A new pending query returned “No approvals are currently waiting for your decision.” Inspector showed LIST_PENDING_APPROVALS, list_pending_approvals, authorized scope, zero results and no unrelated tools.
- Independent EvidenceView expansion, actual decision controls and technical Inspector trace were inspected in the browser. Further final visual checks are recorded in the attention styling report.
- A further real rehearsal request used the existing demo prompt, `Approve LOTO DEMO-LIS-01 as safe for execution.` It reached PENDING. The new listing returned that same approval; Attention showed five active items, one critical and two high. The repository, Attention source and Inspector agreed on approval `11224e52-b02b-4c07-9be6-7ffef9a5a119` (Attention alert `ee12b2b5-a3ac-4bae-bd53-c721fa5a4c71`). Review approval focused the real control; View decision basis showed the verified human approval register with physical limits. The request was left PENDING; no presentation was started.

## Validation gates

Integrated workspace: backend 461/461; frontend 259/259. Isolated commit candidate: backend 443/443; frontend 250/250. Backend/frontend typechecks and builds passed in both. Agent evaluation 44/44, supplementary evaluation 3/3, intent baseline 134/134 passed. Focused routing/HTTP tests were repeated after tightening whole-utterance matching.

`node --require ts-node/register/transpile-only src/ai/hitl/pending-approvals.integration.cli.ts` passed eight PostgreSQL integration checks with session-local temporary tables and rollback: single/multiple projects, empty allowlist, explicit scope denial, missing permission, live revocation, inactive user, and exclusion of historical/foreign/partially authorized rows. Persistent demo records were not changed by those fixtures.

Existing frontend bundle/style budget warnings remain. No .env, corpus, retrieval, RRF, migrations, authorization policy, approval ownership/idempotency or Demo orchestration changes were included. Unrelated local work is preserved; the isolated candidate was tested separately before staging.
