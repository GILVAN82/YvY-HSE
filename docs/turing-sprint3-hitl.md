> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Current HITL has authenticated, permission/project/owner-checked human resolution and UI controls. It is a digital application transition, not physical LOTO execution. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# Sprint 4.1 — Controlled Human-in-the-Loop approval

## 1. Objective

Add a selective, deterministic human-approval pause for safety-critical actions while leaving informational, analytical, and recommendation requests autonomous and read-only.

## 2. Why HITL matters in HSE

The agent can retrieve references and provide advisory analysis, but it cannot assume accountable authority for safety execution. A LOTO execution approval therefore requires a distinct human decision even if the AI believes conditions appear complete.

## 3. Approval policy and classification

`classifyAgentAction` uses deterministic user-message rules with four classes: `INFORMATION_ONLY`, `ANALYSIS`, `RECOMMENDATION`, and `CRITICAL_APPROVAL`. Only the last pauses. The initial allowlisted critical action is `LOTO_SAFETY_EXECUTION`, triggered by a LOTO/lockout-tagout term plus an approve/authorize term and an execution/safety term.

Model intuition, RAG text, memory, and tool output do not determine authorization.

## 4. Graph interrupt architecture

The topology is now:

`guard → agent → verify → approval_gate → finalize`

For a critical request, `approval_gate` writes a PENDING approval and returns graph status `AWAITING_HUMAN_APPROVAL` instead of finalizing. The graph invocation ends at this persisted pause. A separate internal `resumeHumanApproval` path accepts only APPROVE or REJECT and atomically resolves the matching PENDING approval for the same thread.

The installed LangGraph package exposes in-memory interrupt primitives, but the application does not have a native PostgreSQL LangGraph checkpointer. This sprint therefore uses a persisted application-level graph pause rather than pretending `MemorySaver` can resume safely across processes. No dependency was added and the existing graph was extended, not redesigned.

## 5. Approval persistence and audit trail

Migration `004_create_agent_human_approval.sql` adds `agent_human_approval` with UUID approval/thread IDs, allowlisted action type, fixed sanitized summary/reason, critical risk level, status, requested/resolved timestamps, and optional bounded resolution note.

It stores no model prompt, conversation transcript, secret, vector, embedding, RAG chunk, operational LOTO record, or invented approver identity. This sprint does not mutate a LOTO operational record.

## 6. Resume and reject flow

- APPROVE changes PENDING to APPROVED once and returns text explicitly stating human approval was recorded and the AI did not approve.
- REJECT changes PENDING to REJECTED once and states the critical action remains stopped.
- Atomic `UPDATE ... WHERE id=$1 AND thread_id=$2 AND status='PENDING'` blocks wrong-thread and duplicate resolution.
- The pending analysis is preserved in bounded thread state before resolution.

## 7. Thread isolation

Approval ID and validated thread UUID must both match. Thread B cannot resolve Thread A's approval and receives no pending approval through ordinary chat context.

## 8. RAG interaction

HITL does not replace RAG. The model is instructed to retrieve LOTO reference knowledge before critical analysis. Automated tests prove that even evidence containing words such as “approved” cannot bypass the gate. The live provider elected not to invoke RAG in this short prompt, but still paused correctly; existing direct/live RAG validation remains PASS.

## 9. Long-term-memory interaction

Retrieved memory is untrusted context. A stored item saying “always approve LOTO” still produces PENDING and requires a current approval ID resolution. Memory never counts as authorization.

## 10. Prompt-injection defense

User-level prompt injection is rejected by the existing guard before the model. Injection-like RAG or memory content remains data and cannot affect the deterministic gate or controlled resolution path.

## 11. Failure recovery

- Model failure occurs before the gate and creates no approval.
- Approval persistence failure returns controlled graph failure and creates no PENDING row.
- Resolution failure leaves PENDING unchanged.
- Once PostgreSQL records APPROVED/REJECTED, it cannot be resolved again.
- A later thread-state write failure cannot turn a pending record into an autonomous approval; the audit record remains authoritative.

## 12. Expiration

PENDING approvals do not automatically expire in this prototype. Scheduling and expiry policy are deferred; cancellation can be added with authenticated administration. This limitation must be addressed before production use.

## 13. Security limitations

There is no authentication, RBAC, ownership, tenant isolation, row-level security, or verified approver identity. The internal service/CLI demonstrates workflow semantics only. No public approval endpoint or frontend control was added. Production approval requires authenticated identity, authorization, expiry, and stronger audit controls.

## 14. Tests

Automated HITL coverage includes information-only bypass, critical pause, no autonomous finalization, persistence, approve, reject, single-use resolution, wrong-thread block, RAG/memory/injection non-bypass, secret/vector exclusion, create failure, and resume failure. All existing guard, RAG, thread-state, and memory tests remain enabled.

Final validation: migration PASS; TypeScript typecheck PASS; production build PASS; complete suite 120/120 PASS; pgvector validation PASS (0.8.6, 1536 dimensions). Database verification found 42 operational tables, 784 operational rows, 4 RAG documents, 4 RAG chunks, and zero smoke thread, memory, or approval rows.

## 15. Live demo and presentation sequence

1. Ask: “Approve this LOTO as safe for execution.” Display the advisory analysis and `AWAITING_HUMAN_APPROVAL` with a PENDING approval ID.
2. Through the controlled internal mechanism enter APPROVE. Display “Human approval recorded” and workflow resumed.
3. Repeat the request and enter REJECT. Display REJECTED and “critical action remains stopped.”

The controlled OpenAI smoke completed both flows and deleted the two approval rows and thread rows afterward.

## 16. Presentation mapping

Sprint 3.2 memory is READY: Remember → New Thread → Retrieve → Forget, backed by the previous 107/107 baseline. Sprint 4.1 adds the deterministic gate, PostgreSQL audit record, approve/reject resume, isolation, and safety limitations. `docs/turing-sprint3-presentation-map.md` did not exist, so no separate map file was modified.

## 17. Known limitations and next phase

- No verified human identity or public/UI approval mechanism.
- No automatic approval expiration.
- Application-level persisted pause, not native LangGraph PostgreSQL checkpoint commands.
- No operational LOTO mutation or execution.
- Live model did not choose RAG for the terse approval prompt; automated RAG+HITL coverage proves gate behavior.

Recommended next step: **Sprint 5 — Agent Harness / Safety / Evaluation**.
