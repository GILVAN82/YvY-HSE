# Demo navigation and persistent HITL separation

Validated on 2026-09-14 at http://localhost:4300/home, as Turing DEMO Presenter, using DEMO-LIS-01.

## Cause and change

Restart previously performed a partial reset into PAUSED and was blocked by approvalBusy. It did not reset all presentation-local state or abort the current preflight. Skip feedback was overwritten by the next step. An approval discovered by preflight was not pinned for subsequent lookups.

Restart now explicitly selects INTRODUCTION/index 0, clears presentation outcomes, durations, errors, evidence selection and cues, stops the clock and speech, and invalidates asynchronous callbacks. Continue starts the new timer. Navigation does not delete or resolve approvals. Returning to HITL rechecks the retained thread through the existing authorized preflight. Skip marks the presentation step SKIPPED and advances with a separate persistent notice.

The initial browser check reset the header but left the service PAUSED; the exact reported stuck-header symptom was not reproduced in that check. Tests cover the incomplete reset, pending approval separation, in-flight callbacks and navigation races.

## Real browser validation

Using actual UI controls and the live backend:

1. Created a synthetic LOTO request in the normal conversation; confirmed CRITICAL / PENDING.
2. Opened Turing Demo; preflight READY. Navigated to Step 5 and confirmed WAITING FOR HUMAN APPROVAL.
3. Clicked Restart: Step 1 of 6, Introduction active, 00:00, reset progress rail, Introduction ready cue.
4. Continued and navigated back to Step 5: the existing approval was presented as WAITING FOR HUMAN APPROVAL.
5. Clicked Skip: Step 6 of 6, Closing, Human Approval marked skipped, and “Step skipped. The human approval remains pending.”
6. Opened compact technical evidence after Closing: HITL PENDING and “Persisted human decision: PENDING.” No Approve or Reject control was clicked in this validation round.

An earlier round was excluded: its approval changed to APPROVED while opening Inspector, without an intentional decision action by the automation. The cause was not established; that record was preserved and the sequence was repeated with a new pending synthetic request.

## Automated validation

- Workspace frontend: 217 tests passed.
- Isolated HEAD plus the three changed demo files: 209 tests passed.
- Both app and spec TypeScript checks passed in both trees.
- Both production builds passed. Existing bundle/style budget warnings remain. Builds required sandbox escalation for dependency directory reads.
- Explicit tests assert pending approval survives Restart to INTRODUCTION/index 0 with timer reset, and Skip to CLOSING. Additional tests cover approval reference reuse, stale preflight/agent/voice/timer callbacks, multiple steps and controller buttons.

Backend approval ownership, authorization and idempotency implementation are unchanged. Unrelated local changes are excluded from this commit.
