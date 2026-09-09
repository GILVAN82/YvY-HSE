> **Sprint I update:** The [Turing Demo Mode](TURING_DEMO_MODE.md) presentation sequence is implemented behind a server flag, reusing the real agent and a manual HITL gate. Full safe-context manual acceptance and timed rehearsal remain pending. Showcase is still MISSING. The H plan/status below is retained as its versioned baseline; I supersedes only the implementation-pending item.

# Turing demo content plan

FUTURE / PLANNED ONLY. H does not implement Demo Mode or execute approval/operational changes. These steps use committed runtime `a0edf23`; confirm access and suitable non-sensitive records before rehearsal. Do not promise a fixed record count.

| Demo step | Real capability used | Expected result | Fallback | Inspector evidence | Turing requirement |
|---|---|---|---|---|---|
| Introduction | Command Center and authenticated consultation | Explain user, problem and bounded assistant in 30 seconds. | Show README purpose if service unavailable. | None needed. | Problem/purpose; interactive prototype. |
| Tool Calling | Scoped list_actions or list_incidents | Current permitted records or truthful NO_DATA. | Show retained test/run evidence labelled recorded; never invent records. | intent, tools, verification. | Tool integration; outcome controls. |
| RAG + Citation | search_hse_knowledge | Approved LOTO/PTW reference and citation, or controlled no-evidence state. | Display retained 24-query evidence as replay, not a live answer. | route, RAG/evidence, verification. | Complementary RAG; grounding. |
| Memory | Explicit safe workflow preference save and same-owner retrieval | Preference used as context, never policy or HSE fact. | Explain repository and tested lifecycle; do not claim a save succeeded if unavailable. | tools, route. | State and advanced execution. |
| HITL | Classified digital LOTO pending decision | Request with an exact authorized project code stays PENDING until permitted human resolves; no equipment safety claim. | Show tested pending/denial flow; unresolved scope is a valid refusal. | HITL, verification. | Human oversight and advanced execution. |
| Trust / Closing | Verification, prompt identity and failure controls | State limitations, separate quality metrics, name next steps. | Use H evidence dashboard. | runId, prompt version. | Ethics, evaluation and documentation. |

Memory save/forget and approval are real persisted actions; use a deliberate synthetic rehearsal context. Do not approve a real operational request just to demonstrate a button. A presentation plan is not evidence that any demonstration has occurred.

## Agent Inspector demo view plan

Show **at most eight fields**, only when relevant: **runId, intent, route, tools, RAG/evidence, verification, HITL, prompt version**. Each comes from the actual execution snapshot; absent fields stay absent. No new UI is implemented in H.

Do not display raw prompts, user identity, attachments, memory contents, SQL, full records, provider debug payloads, token/cost panels or unrelated monitoring during the demo. The runtime may retain additional safe diagnostics, but they are not part of the planned presentation view. Inspector is session-local and is not an immutable audit archive.

## Rehearsal preflight (remaining)

Confirm authenticated user/project/approver permissions, backend/frontend, existing corpus, configured provider and browser microphone support. Use a known non-sensitive case. Keep typed input and clearly labelled recorded evidence available. Confirm the pending/denial path before demonstrating a human decision. Measure timing against the presentation matrix and obtain Gilvan's acceptance of the final story. Showcase URL remains user action.
