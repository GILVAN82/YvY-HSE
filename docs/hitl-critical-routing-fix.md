# Critical LOTO routing / HITL

## Root cause (recorded before implementation)

The exact input `Approve LOTO DEMO-LIS-01 as safe for execution.` survives normalization with its project identifier intact. The existing deterministic `classifyAgentAction` already recognizes it as `CRITICAL_APPROVAL`. However, `classifyIntent` never consults that policy: its generic LOTO vocabulary selects `SEARCH_HSE_KNOWLEDGE`. The methodological knowledge policy does not match this imperative; the later keyword fallback does.

The graph only evaluates criticality inside `approvalGateNode`, after `verifyOutcome`. When the generated answer makes an unsupported safety claim, verification correctly returns `SAFETY_BLOCKED`, and `verifyOutcome` routes directly to `finalize_failure`. The gate is unreachable. No deterministic approval requirement exists in graph state. Existing HITL regression tests use innocuous model answers and therefore miss this interaction.

The classifier also lacks locking-out/restart paraphrases and same-thread follow-up context. The approval repository requires an explicit project in the current request, so contextual follow-ups additionally need a bounded, owner-checked project antecedent; arbitrary client history must not establish authorization.

## Design

Resolve criticality before generic intent routing, using the same deterministic policy in the guard. Carry a per-run approval requirement through verification. Verify generated claims first, retain the original verification result, and replace critical responses with controlled non-authorizing text before the approval gate. Never route upstream authorization/provider failures into approval. Keep the existing authenticated approval resource and single-use resolution controls.

Context is restricted to the immediately preceding user turn in the same thread and explicit LOTO/energy-isolation vocabulary. A topic change ends this inference. Project scope remains checked by the repository against the authenticated principal and server-persisted thread.

## Behavior and boundaries

Old: `SEARCH_HSE_KNOWLEDGE → guard → agent → verify (SAFETY_BLOCKED) → finalize_failure`.

New: `CRITICAL_LOTO_APPROVAL → guard → agent → verify → approval_gate → PENDING`. The original verification result stays visible, including `SAFETY_BLOCKED`. The emitted text is controlled: “This request requires human approval. YvY cannot confirm physical isolation or authorize the work.” The same message is available in EN/PT/ES/FR/DE. This is an approval request, never an execution authorization.

Informational questions, including `Explain OSHA 1910.147.`, remain knowledge queries. A bounded execution follow-up may inherit LOTO context from the immediately preceding user turn. An approval resource can inherit exactly one project only from the owner's server-persisted, authorized thread. Missing, ambiguous, changed or denied project scope fails closed. Re-energization itself is a critical energy action. An arbitrary restart without LOTO context does not inherit a critical intent.

The runner clears per-run approval/verification/error state before checkpoint reuse, so a later informational turn cannot masquerade as an earlier pending resource. Upstream authorization, provider, timeout and execution failures remain failures. No retrieval, RRF, corpus, citation or semantic-verifier algorithm was changed. The demo phrase and step implementation were not changed.

Approval creation still uses the existing resource contract; no automatic resolution or new retry/reuse contract was introduced. Existing authenticated approver, permission, ownership, project/resource linkage and conditional single-use resolution checks remain in place. Knowing an approval ID does not grant access. The shared Evidence View continues to show the human decision basis and inability to confirm physical isolation beside any RAG evidence.

## Validation — 2026-09-14

| Gate | Working tree | Isolated commit candidate |
|---|---:|---:|
| Backend tests | 415/415 | 397/397 |
| Frontend tests | 199/199 | 191/191 |
| Agent evaluation | 44/44 | 44/44 |
| Supplementary evaluation | 3/3 | 3/3 |
| Intent baseline (dataset v2) | 134/134 | 134/134 |
| Backend/frontend typechecks and builds | PASS | PASS |
| Hermetic backend, no `.env` or provider/database credentials | — | 397/397 |

Retrieval baseline: required-source recall and relevant recall@K remain 1.0 in semantic and RRF modes. RRF MRR and top-1 source accuracy remain 1.0; irrelevant retrieval rate remains 1/6 in both modes. This is the existing simulated baseline, not production recall.

The isolated candidate is exported from `6adcd8b` plus only the task changes. Its lower test counts exclude unrelated uncommitted work. Frontend builds pass with existing bundle/style budget warnings. New regression coverage adds 17 critical inputs (including the exact failure) to the 15 existing formulations, three contextual follow-ups, eight informational knowledge cases, real-graph/real-repository scope tests, blocked-verification event checks, and checkpoint-state isolation. Tests use synthetic models, retrieval and database executors; the production graph and approval repository are exercised. No live presentation or human decision was started.

Reproduce with `npm test`, `npm run eval:offline`, `npm run eval:retrieval`, `npm run typecheck`, and `npm run build` in backend; `npm run test:ci -- --progress=false`, app/spec `tsc --noEmit`, and `npm run build` in frontend. For hermetic validation export the candidate source, static fixtures and approved corpus without `.env`, attach installed dependencies, remove process-local database/provider configuration, and run backend tests. The committed validation artifact records source hashes and the distinction between working-tree and isolated results.

## Turing / review evidence mapping

| Area | Concrete evidence |
|---|---|
| Turing — Advanced Agent Execution | Deterministic intent precedence and explicit graph state survive verifier rejection; real route asserts `verify → approval_gate`. |
| Turing — Ethical AI / Human Oversight | No generated claim can authorize work; pending resources require existing authenticated human resolution. |
| Jochen — HITL gate / focused demo | Exact Step 5 input covered without any demo bypass; canonical gate and scope repository tested together. Manual rehearsal remains separate. |
| Fatima — impossible-state prevention | Blocked generated claims are not emitted; informational checkpoint turns cannot inherit pending approval state. |
| Andrius — failure mode / design reasoning | Root cause above recorded before implementation; verifier retained before gate with original verdict, rather than moved or weakened. |
| Justinas — safe failure behavior | Missing/denied project context and upstream failures remain fail-closed; unsupported safety statements become explicit human-review limitations. |

These are repository evidence mappings, not reviewer sign-off or a claim of physical safety.
