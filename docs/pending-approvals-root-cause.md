# Pending approvals: cause recorded before implementation

`Show pending approvals` is normalized but has no explicit intent or canonical pending-approval tool. It falls through to an ambiguous intent, leaving the general model tool registry available. The registry contains operational data tools, not a read-only HITL listing. Unrelated tool calls can therefore produce unrelated empty evidence cards.

The finalizer maps every authorization/ownership/scope/not-found failure to the same LOTO-specific text, even for a read-only query. Actual LOTO creation correctly requires a project; that creation rule must remain intact. A pending listing must never invoke creation or borrow the critical request path.

Operational Attention already reads `agent_human_approval` with pending status, thread ownership, requester ownership and live project membership. The fix will move that read to the canonical approval repository and reuse it for Attention and a deterministic `LIST_PENDING_APPROVALS` / `list_pending_approvals` path. Screen scope is a filter to validate, never authorization. Generic queries use the authenticated authorized scope.

Browser trace comparison and validation results will be recorded after implementation; the reported browser failure has not yet been independently reproduced in this turn.
