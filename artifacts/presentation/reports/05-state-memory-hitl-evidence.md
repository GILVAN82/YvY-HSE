# State, Memory and HITL Evidence

## Thread continuity and isolation

- Same-thread LOTO continuation: PASS in live-safe and real Angular validation.
- Cross-thread leakage: NO in automated and controlled smoke evidence.
- Persisted store: `agent_thread_state`.
- Bound: 30 recent messages.
- Frontend inactivity lifecycle: a new conversation starts after 15 minutes.

## Long-term memory

- Explicit `Remember that...` intent: PASS.
- Normal conversation automatically saved: NO.
- Cross-thread retrieval, idempotency, explicit update and forget: PASS.
- Secret/sensitive-data rejection: PASS.
- Memory broadens domain scope: NO.
- Persisted store: `agent_long_term_memory`.

## HITL

- Critical action: `LOTO_SAFETY_EXECUTION`.
- PENDING / `AWAITING_HUMAN_APPROVAL`: PASS.
- Controlled APPROVE and REJECT paths: PASS.
- Wrong-thread resolution: BLOCKED.
- Double resolution: BLOCKED.
- AI self-approval: IMPOSSIBLE through the gate.
- Persisted store: `agent_human_approval`.
- Prototype limitation: human identity is not verified.

No HITL frontend screen exists. This report, the HITL diagram and deterministic tests are the truthful fallback evidence.
