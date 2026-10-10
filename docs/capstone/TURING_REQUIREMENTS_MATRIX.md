# Final Project requirements

2026-09-14; runtime `f9b58d0`. [Canonical final evidence](FINAL_SUBMISSION_BASELINE.md).

Case 2 is primary; RAG is complementary; Cases 3-7 are not claimed.
| Requirement | Status | Evidence / remaining |
|---|---|---|
| Purpose / design / tools / advanced execution | IMPLEMENTED / VALIDATED within tests | State graph, bounded loop, scoped tools, memory, verification, HITL |
| Interactive prototype / UI | IMPLEMENTED | Canonical Command Center; normalized legacy snapshots; final gate required |
| Evaluation | VALIDATED within datasets | 449 backend; 262 frontend; 44 agent; 134 intent; 24 retrieval |
| Prompt / function calling / learning | IMPLEMENTED | Versioned policies and real tool execution; oral ownership remains |
| Ethics / privacy | IMPLEMENTED with limitations | Scope, owner, human authority; no physical safety certification |
| Documentation | UPDATED | Final submission baseline supersedes historical rows below |
| Presentation | REMAINING | Six steps implemented; continuous timed rehearsal remains |
| Showcase / README URL | MISSING / USER ACTION REQUIRED | Real URL pending |
The full original institutional rubric is not present; this maps the user-supplied applicable requirements.

## Historical sprint reference

The remainder preserves earlier source evidence. Its counts, local-feature labels and readiness states are superseded by the final baseline above.

# Project requirements matrix

## Sprint I.1 — critical LOTO routing correction

[Canonical HITL correction and validation](../hitl-critical-routing-fix.md) adds deterministic critical-intent precedence, carries the human-approval requirement through verification, and proves `SAFETY_BLOCKED` can coexist with a safe `PENDING` request. This updates Advanced Agent Execution and Ethical AI / Human Oversight evidence. It does not certify a live rehearsal or authorize physical work.

## Current Sprint I presentation status

| Item | Status | Evidence | Remaining |
|---|---|---|---|
| Interactive prototype / deterministic presentation | ✅ | Real service/controller; 32 new frontend tests | Safe-data six-step manual acceptance |
| Agent design / tool integration / advanced execution | ✅ | Unchanged graph, actual chat path, manual HITL tests | Live rehearsal; no autonomous approval |
| Evaluation explanation / ethics | ✅ | Presenter cues and explicit boundaries | Gilvan oral defence |
| Presentation readiness | 🟡 | Entry observed; full manual flow not completed | Final timed rehearsal and human decision |
| Jochen focused tools / RAG / memory / HITL demo | 🟡 | Implemented six-step sequence | Manual acceptance |
| Andrius code ownership | 🟡 | Defence note and code map | Presenter explanation |
| Showcase / README URL | ⬜ | Pending marker retained | USER ACTION REQUIRED |

> **Sprint I update:** The [YvY HSE Demo Mode](TURING_DEMO_MODE.md) presentation sequence is implemented behind a server flag, reusing the real agent and a manual HITL gate. Full safe-context manual acceptance and timed rehearsal remain pending. Showcase is still MISSING. The H plan/status below is retained as its versioned baseline; I supersedes only the implementation-pending item.

Canonical project source: **Case 2 - AI agent for task automation**, with RAG as a complementary capability, using the criteria explicitly supplied by Gilvan in the Sprint H request. The repository does not contain the complete original institutional grading rubric. This matrix maps the user-supplied official project scope; it does not invent rubric wording, certify a grade or assert reviewer acceptance.

Runtime baseline `a0edf23`, branch `capstone/yvy-hse`; H is the documentation commit containing this file. COMMITTED runtime evidence is distinct from preserved LOCAL / UNCOMMITTED features; Demo Mode is FUTURE.

Legend: 🏁 VALIDATED = tested within a stated boundary; ✅ IMPLEMENTED = implemented/documented; 🟡 REMAINING = real follow-up remains; ⬜ MISSING = absent. An implemented item can retain a limitation without implying certification.

| Requirement | Status | Evidence | Tests | Commit | Remaining |
|---|---|---|---|---|---|
| Problem / purpose | ✅ IMPLEMENTED | README purpose; H story | Documentation review | H | No measured accident-reduction claim. |
| Agent design | 🏁 VALIDATED | Graph/runner; DEFENCE_NOTES | Graph and 44-case evaluation | a0edf23 | None within declared controlled workflow. |
| Tool integration | 🏁 VALIDATED | Scoped createHseTools/appDataTools | Tool, HTTP and authorization tests | 1d93165 + a0edf23 | Local record drafting excluded. |
| Advanced execution | 🏁 VALIDATED | Memory, guard, verification, digital HITL | Memory/HITL/semantic suites and agent scenarios | 79f3f41 + a0edf23 | Physical execution and native durable graph resume not claimed. |
| Interactive prototype | ✅ IMPLEMENTED | Angular chat, Inspector, voice, attention | 112 committed frontend tests and build | a0edf23 | Human rehearsal and browser/microphone preflight. |
| Evaluation | 🏁 VALIDATED | 44/44 agent; 134/134 intent; 24 retrieval cases | H gates and retained JSON | 79f3f41 + 8b0e987 + a0edf23 | Live and larger independent quality evidence remain bounded limitations. |
| Documentation | ✅ IMPLEMENTED | README, architecture, map, defence, QA and matrices | H link/symbol/claim checks | H | Human review of presentation wording. |
| Ethical considerations | ✅ IMPLEMENTED | README consolidated ethics; security and limitations | Auth/isolation and prompt tests; documentation audit | 1d93165 + a0edf23 + H | Residual privacy/retention/deployment governance documented. |
| Outcome quality | 🟡 REMAINING | Offline controls and small retrieval corpus pass | Separate simulated and real retrieval gates | 8b0e987 + a0edf23 | Current live-provider answer quality not fully benchmarked. |
| Learning application | ✅ IMPLEMENTED | Controlled workflow, schemas, retrieval, evaluation and defence | Mapped symbols and tested contracts | D-G + H | Gilvan must demonstrate ownership in oral review. |
| Presentation readiness | 🟡 REMAINING | Six-point matrix and planned demo | Documentation only; no rehearsal evidence | H | Rehearse, preflight, approve final timing; Demo Mode separate. |
| Showcase | ⬜ MISSING | No real URL supplied | Not applicable | H | USER ACTION REQUIRED: submit real Showcase. |
| README showcase link | ⬜ MISSING | Visible pending marker near top | Marker audit; no invented URL | H | USER ACTION REQUIRED: provide real URL, then replace marker. |

[Final gates and all remaining items](SPRINT_H_FINAL_COMPLIANCE.md) | [Reviewer feedback register](REVIEW_COMPLIANCE_MATRIX.md). H commit can be resolved with `git log -1 --format=%H -- docs/capstone/TURING_REQUIREMENTS_MATRIX.md`; runtime source remains `a0edf23`.
