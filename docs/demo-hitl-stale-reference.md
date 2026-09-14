# Human Approval recovery from a stale demo reference

The real browser reproduced Step 5 failing with: “A previous demo approval request was dispatched. Its outcome is unresolved or unavailable. No duplicate request will be sent.” No approval request was sent in that attempt.

The demo retained a dispatch thread marker, while preflight only searched that thread. A pending approval already existed for Turing DEMO Presenter and DEMO-LIS-01 in another owned thread. The marker therefore prevented the presentation from finding the pending application resource.

Preflight now prefers a real resource in the marked thread, including resolved decisions, and otherwise searches existing pending resources belonging to the same requester and configured project. PostgresApprovalService.get still performs the canonical ownership and scope checks. The endpoint remains read-only; an unknown marker with no available resource still does not cause an automatic duplicate request.

Manual validation on localhost:4300: reproduced the failure, applied the change, clicked Retry at Step 5, and observed WAITING FOR HUMAN APPROVAL with enabled Approve and Reject buttons. The existing resource was 0ab757a6-f9c6-4646-bcb6-f422b4fbfe85 in thread 5c6d65ca-1687-492d-9bff-547a188df19c. No new approval rows appeared. A subsequent read showed this same resource APPROVED; the user confirmed clicking Approve manually. Automation did not click a decision control. Its state was preserved.

Regression tests cover stale-reference lookup, requester/project filters, marked-thread priority, read-only behavior and rejection by canonical authorization. No HITL routing, resolution, RAG, environment or database migration changes were made. Unrelated local changes are preserved.

Validation: backend 420/420 tests passed, typecheck passed, build passed.
