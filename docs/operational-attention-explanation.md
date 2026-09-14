# Canonical operational attention and alert explanation

## Contract and responsibility

Operational attention is an application feature, independent of Turing Demo. The shared `AttentionFacts` / `AttentionItemViewModel` presenter and reusable summary/item components provide count, supported severity, lifecycle status, project, explanation and contextual actions. They never render raw alert rows, evidence metadata arrays or database identifiers. Existing acknowledgement behavior remains available; a current/history control makes resolved decisions inspectable.

The previous UI inserted `sourceId` into the visible question and sent frontend descriptions as supposedly verified alert context. There was no authoritative single-alert explanation path, so a LOTO explanation could be classified as a knowledge/safety request and receive a generic grounding refusal. The new action sends a natural localized question and a separate `attentionAlertId`. Frontend alert descriptions are no longer appended as trusted context.

## Authorized retrieval and explanation

`PostgresAttentionReader.get` is the canonical read-only single-alert mechanism, recorded as `get_attention_alert`. It checks HSE_DATA_READ, user ownership, live account/project/source membership through the existing `alertAccessSql`, principal project scope, and the principal-scoped approval repository. Deleted, inaccessible and revoked resources are not disclosed. It does not create or resolve approvals or update operational records.

The chat boundary validates the alert reference, checks AI_USE and conversation ownership, ignores client-supplied descriptions/page context as authority, and selects deterministic `EXPLAIN_ALERT`. This path projects authorized repository facts instead of requiring an LLM to restate them. It therefore remains usable without a configured model. For LOTO it optionally retrieves supporting approved knowledge through the existing retriever. Normal LangGraph, critical execution/HITL, retrieval/RRF and verification policies remain unchanged.

Operational status and physical safety are separate claims. A pending approval can be verified from its repository; that does not establish physical isolation or safe field conditions. The response explicitly says that YvY cannot verify those conditions or authorize the work. If supporting RAG is unavailable, repository facts are still explained with PARTIALLY_VERIFIED and an explicit missing-guidance message. Inaccessible alerts receive a scope-aware access message, not the generic unsupported-answer fallback. Actual safety authorization requests outside the structured explanation path retain the existing critical routing and verification behavior.

## Evidence, lifecycle and localization

Review approval focuses the actual linked application approval control; it never clicks Approve/Reject. View decision basis opens the same EvidenceViewComponent for current operational status, source, project, checked time, physical limitations and next action, plus approved knowledge sources when retrieved. Operational status is not attributed to a knowledge document. Sources use safe link actions, not URL dumps. The existing passage presentation limit remains in force: an oversized passage points the user to its full source rather than displaying a document dump.

Response evidence actions distinguish View sources, View decision basis and Why this needs confirmation. English, Portuguese, Spanish, French and German copy is included. Record descriptions and source document titles retain their original language.

Current source status overrides stale pending presentation for APPROVED/REJECTED decisions. A changed action deadline uses the canonical overdue rule rather than treating an old alert as proof of a current overdue condition. Acknowledged/resolved alerts stay outside the active count. A successful human decision immediately removes its alert from active attention while retaining history. Resolving a linked approval updates the corresponding timeline facts even when the explanation conversation differs from the original approval thread.

Inspector retains the alert reference, approval reference/thread, execution route and actual retrieval/verification diagnostics. Only the validated alert identifier is added to its stored tool arguments; arbitrary client objects and private query text remain excluded.

Future categories on authorized operational sources receive a safe generic typed presentation. New source families must add an explicitly authorized read adapter/source access policy; unsupported access fails closed. There is no raw-ID/JSON fallback and no automatic grant of access to future tables.

## Manual acceptance — localhost:4300, 2026-09-14

Authenticated session: Turing DEMO Presenter; project DEMO-LIS-01; database hse_app_demo. No login/password was filled by automation. A temporary login screen during reloading cleared before testing continued.

- Summary showed Operational attention, 5 items need review, 1 critical and 2 high, with one Review attention items action. The remaining items were not invented as high severity.
- Selected the real critical LOTO alert. Visible question: “Explain this critical LOTO approval alert.” No UUID appeared in the question, answer or business evidence.
- Answer confirmed Awaiting human decision, identified DEMO-LIS-01, reported approved guidance availability and explicitly refused to assert physical isolation or authorize work.
- Review approval focused the real PENDING card with Approve/Reject. Neither decision was clicked during this task.
- View decision basis opened current operational evidence and the approved OSHA source with jurisdiction, version and View source. The business UI did not show raw JSON, recordCount, Filters or SUCCESS_WITH_DATA.
- Inspector showed EXPLAIN_ALERT, guard / get_attention_alert / search_hse_knowledge / verify / respond, HYBRID retrieval, VERIFIED operational facts and PHYSICAL_STATE_NOT_ASSERTED.
- Technical references observed in Inspector: alert `74805bd2-4573-4bff-8224-536883d204e9`; approval `e0436628-7bfd-4812-9738-939b8bc5c6bb`; approval thread `100206b4-6aad-48a3-a38f-9139e26fea0f`; explanation thread `ffd1882e-26fe-4ae9-bc45-5be755d065c3`.
- Read-only live database checks confirmed authorized access and denial for a different owner, different project scope and revoked read permission. Approval remained PENDING; no database writes were performed by these checks.

RAG outage, denied access, lifecycle variants and all five languages were tested automatically. No production permissions or memberships were modified to simulate denial.

## Validation

- Integrated frontend: 247 tests; isolated candidate: 238 tests.
- Integrated backend: 440 tests; isolated candidate: 422 tests.
- Frontend/backend typechecks and builds passed for the integrated workspace and isolated candidate. Existing frontend bundle/stylesheet budget warnings remain.
- Agent baseline 44/44, supplementary 3/3; intent baseline 134/134.
- RRF baseline: required-source recall 1, relevant recall 1, MRR 1, top-1 source accuracy 1; irrelevant retrieval rate 1/6.
- Tests cover structured metadata, model-independent read routing, forged UI context, denied access, current/historical status, partial RAG, localization, safe fallback, independent evidence expansion, linked approval updates and technical-only Inspector references.

Only the canonical attention changes are included in the commit. Unrelated local work, environment settings, migrations and operational approval history are preserved.

## Review value

| Review lens | Concrete behavior |
| --- | --- |
| Turing — outcome / interaction quality | Specific current alert explanation, clear count and contextual actions |
| Turing — ethical AI / human oversight | Verified operational facts do not imply physical safety; real human approval controls remain separate |
| Jochen — HITL / focused demo / factual semantics | Read-only explanation, no automatic decision, explicit inaccessible and partial states |
| Andrius — separation of concerns / failure semantics | Repository authorization, deterministic explanation and presentation have separate responsibilities |
| Justinas — actionable errors / near-source handling | Live source reread and useful scope/RAG-unavailable messages |
| Fatima — typed contracts | Minimized facts and a shared business view model replace direct raw-row rendering |
