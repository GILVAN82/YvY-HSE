# Project live human decision validation ? 2026-09-14

Root cause: the presentation consumed an application approval status as completion, without proving a decision in the current presentation. Persisted preflight decisions therefore satisfied later rehearsals. Conversation approval buttons also bypassed presentation correlation, and historical timeline snapshots could show stale PENDING after the active resource changed.

The current presentation now correlates demoSessionId, requestInstanceId (owned conversation), approvalId/resourceId, projectId, status and decisionMadeDuringCurrentDemo. A finalized approval is history; a new request instance goes through the existing agent, verification and real approval gate. A pending request is reused and remains WAITING_FOR_HUMAN. Dispatch markers, generation guards and busy guards prevent repeated dispatch/resolution. Both UI decision entry points use the same correlated handler during the demo. Only a successful matching explicit decision completes the step. Historical timeline status is retained.

Approve and Reject use the existing authenticated resolver. Reject completes the demonstration normally. Continue is disabled while pending. Restart resets presentation state and correlation while retaining application approvals. Skip retains pending approval. Decision basis uses EvidenceView; identifiers and correlation stay in Inspector. No backend, retrieval, authorization, migration or environment changes are included.

## Browser acceptance

Environment: localhost:4300, dedicated hse_app_demo context, DEMO-LIS-01, YvY HSE Demo Presenter.

- Observed Step 5 pending with Approve/Reject and disabled Continue before a decision. Observed subsequent APPROVED, completed Step 5, enabled Continue and ?No physical work was performed.? Gilvan explicitly confirmed clicking Approve during validation. Multiple rehearsals were performed; no decision button was clicked by the validation tool.
- Restart visibly returned to Step 1 of 6, Introduction active, 00:00.
- Final restart check navigated with Skip to isolate Step 5. Previous APPROVED did not complete the new step. New session `6d722f79-4621-45a1-96a5-1aa612b5668d`, request `fa593fc1-b456-4fb4-a13d-e354dabb1bb9`, approval `6fa37d08-79f6-46d7-86a1-f130f5e4c897`: PENDING; Decision source NONE; Human Approval active; Approve/Reject visible; Continue.isEnabled() returned false.
- Actual run `4545ebf1-e8d8-405c-b850-fd93e241656e`: CRITICAL_LOTO_APPROVAL; guard / agent / verify / approval_gate; search_hse_knowledge; HYBRID with two evidence items; SAFETY_BLOCKED.
- Presentation left at Step 5 after this observation. No Closing/Continue was triggered. No physical work was performed.
- Reject, duplicate-click prevention, historical rejected decision, pending retry, external resolution, ownership/project denial and Skip/Restart are covered by automated regression; live Reject was not performed.

## Validation

- Integrated frontend: 227/227 tests.
- Isolated commit candidate: 218/218 tests (excludes unrelated local work).
- Both frontend app typechecks and production builds passed. Existing stylesheet/bundle budget warnings remain; initial sandbox Sass path resolution failed, then builds passed outside the filesystem restriction.
- Backend: 420/420 tests, typecheck and build passed (unchanged by this fix).
- Agent: 44/44, supplementary 3/3; intent: 134/134.
- Retrieval baseline: required-source recall 1, relevant recall 1, MRR 1, top-1 accuracy 1; unchanged RRF.

Unrelated local changes, including independent Operational Overview card layout changes, are excluded from this commit.
