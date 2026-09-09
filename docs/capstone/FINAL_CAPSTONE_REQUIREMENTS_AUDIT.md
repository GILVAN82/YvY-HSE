> **HISTORICAL / VERSIONED SPRINT EVIDENCE.** Preserve the measurements and source baseline below. The current consolidated authority is [Sprint H](SPRINT_H_FINAL_COMPLIANCE.md), [test strategy](TEST_STRATEGY.md), [requirements](TURING_REQUIREMENTS_MATRIX.md) and [review matrix](REVIEW_COMPLIANCE_MATRIX.md). Earlier counts, line numbers, readiness decisions and pending items are not current claims. No old live result validates the current model/prompt baseline.

# YvY HSE Final Capstone Audit

## Executive Summary

**Decision: AMBER — technically ready; official rubric unavailable for verification.**

The current AI Agent, security controls, evaluation evidence, frontend, builds, and presentation material are internally consistent and well supported. The ordinary local backend suite passes 231/231, the frontend passes 30/30, deterministic evaluation passes 37/37, and the committed live OpenAI evidence remains 11/12 (91.7%).

Sprint 5.4 reproduced and corrected the remaining fresh-checkout failure path:

```text
backend/src/auth/__tests__/authorization.test.ts
  → imports computeKpi from backend/src/routes/kpi.ts
  → imports backend/src/db/pool.ts
  → requireDatabaseUrl() at module initialization
  → Error: Database configuration is required (baseline)
```

Reusable KPI computation now requires an explicit query executor, while production binds the real pool at `index.ts` and `productionDependencies.ts`. The complete clean-copy suite passes 233/233 without `.env`, `DATABASE_URL`, PostgreSQL, provider keys, or provider network. The only remaining uncertainty is the absent official Capstone rubric, not an application defect.

## Official Requirements Source

**OFFICIAL REQUIREMENTS SOURCE: NOT FOUND**

The repository does not contain an authoritative Turing College Capstone brief or grading rubric. `docs/turing-sprint3-final-validation.md` explicitly states that its five criteria are **PROJECT INTERPRETATION** and that the authoritative brief is not present. `README.md` contains a Sprint 3 mapping and explicitly says it does not claim official Turing approval.

To complete an official-requirements audit, supply the original Turing College Capstone assignment brief or assessment rubric containing the authoritative requirements and evaluation criteria (PDF, copied text, or accessible course-page export). The matrix below therefore covers verified reviewer feedback and current technical evidence only; it is not represented as the official rubric.

## Requirements Traceability Matrix

| ID | Requirement | Source | Current implementation | Primary file / symbol / lines | Automated test evidence | Evaluation/demo evidence | Status | Residual gap |
|---|---|---|---|---|---|---|---|---|
| OFF-01 | Official Capstone requirements | Authoritative source absent | Cannot be audited without inventing criteria | `docs/turing-sprint3-final-validation.md`, lines 22–26 | N/A | N/A | NOT_APPLICABLE | Supply official brief/rubric. |
| JF-A | Default `npm test` works without PostgreSQL | Known Jochen feedback | Complete suite uses injected fakes; reusable KPI import is configuration-free | `routes/kpi.service.ts`, `computeKpi`; `routes/kpi.ts`, `createKpiRouter` | Clean no-`.env` simulation: 233/233 | Normal local run: 233/233 | PASS | None. |
| JF-B | Inject fake DB/dependencies into runner/tool path | Known Jochen feedback | KPI accepts an explicit executor; real pool is bound only at production boundaries | `ai/productionDependencies.ts`, scoped KPI composition; `index.ts`, router composition | Import regression plus authorization fake | Hermetic correction record | PASS | None. |
| JF-C | Name and defend agent pattern | Known Jochen feedback | Controlled Stateful LangGraph Agent documented and code-mapped | `ai/graph/hseAgent.graph.ts`, `buildHseAgentGraph`, lines 22–52 | Graph/agent regression suite | Sprint 5.1 document and presentation | PASS | None. |
| JF-D | Compare ReAct and Plan-and-Execute | Known Jochen feedback | Bounded ReAct-like inner loop distinguished from overall workflow; planner use explained | `ai/graph/nodes/agent.node.ts`, lines 55–201 | Bounded loop/step-limit tests | Architecture and demo guide | PASS | None. |
| JF-E | Improve zero-result semantics | Known Jochen feedback | Structured success envelopes and `NO_DATA` status | `ai/tools.ts`, lines 44–57; `ai/responseStatus.ts`, lines 15–29 | Response-status and agent regression tests | 37/37 and live no-data scenario | PASS | None. |
| JF-F | Extend frontend tests | Known Jochen feedback | Widget, Inspector, auth, routing, and Markdown coverage | `frontend/src/app/**/*.spec.ts` | 30/30 | Presentation UI flow | PASS | None. |
| JF-G | Focus demo on AI Agent | Known Jochen feedback | Ten-slide, ten-minute Agent-centered story | `docs/capstone/CAPSTONE_PRESENTATION_AND_DEMO.md` | N/A | Three-demo plan | PASS | Rehearsal remains operational preparation. |
| JF-H | Prioritize tools, RAG, HITL | Known Jochen feedback | Exactly three core demos | Presentation lines 150–241 | Backend and frontend coverage | Function calling, RAG, HITL demos | PASS | Live environment must be checked before review. |
| JF-I | Explain HSE professional value | Known Jochen feedback | Decision-support value and non-replacement boundary stated | Presentation introduction/conclusion | N/A | Closing statement | PASS | No unsupported productivity metric claimed. |
| TECH-ARCH | Controlled graph, state, routes, failure paths | Current code | Guard → Agent → Verify → Approval → Finalize, with refuse/failure branches | `hseAgent.graph.ts`, 22–52; `hseAgent.state.ts`, 23–80 | Agent graph tests | Inspector/presentation | PASS | Native durable LangGraph resume remains intentionally absent. |
| TECH-TOOLS | Approved, scoped, read-only tools | Current code | Explicit schemas for seven tools; parameterized queries and result envelopes | `ai/tools.ts`, 59–205 | Agent, authorization, HTTP, egress tests | Tool metrics 11/11 | PASS | New tools require equivalent scope/egress review. |
| TECH-RAG | Approved corpus, retrieval, grounding, citations | Current code | Four-source registry, pgvector repository, no-evidence status, citation verification | `rag/sourceRegistry.ts`, 10–206; `rag/retrieval.service.ts`, 9–36 | RAG ingestion/retrieval/graph tests | Grounding 13/13; live RAG 2/2 | PASS | Corpus is intentionally limited. |
| TECH-MEM | Bounded user-owned short/long-term memory | Current code | Sanitized thread store; explicit save/update/forget; secret/sensitive rejection | `threadState.repository.ts`, 22–82; `memory.service.ts`, 9–81 | Thread and memory lifecycle/isolation tests | Memory accuracy 9/9 | PASS | Memory is contextual, not authoritative evidence. |
| TECH-HITL | Deterministic critical approval boundary | Current code | LOTO classification, pending gate, authorized single-use resolution | `hitl.policy.ts`, 3–11; `approval.node.ts`, 6–24; `hseAgent.runner.ts`, 248–260 | HITL and approval HTTP tests | HITL 9/9; live 1/2 with safe pending behavior | PASS | Human approval is not field verification. |
| TECH-AUTH | Authentication, RBAC, project/tool scope | Current code | Server-derived principal, four roles, permissions, scoped tool factory | `auth/authorization.ts`, 4–27; `routes/aiChat.ts`, 95–179 | Auth/authorization/HTTP tests | Authorization 9/9; live 1/1 | PASS | No company-level tenancy. |
| TECH-STATUS | Seven semantic response states | Current code | Stable semantic status separate from technical graph status | `ai/responseStatus.ts`, 3–29; Inspector service lines 11–17 | Response-status tests | Semantic accuracy 6/6 plus HITL lifecycle | PASS | None. |
| TECH-MD | Safe assistant Markdown and plain user text | Current code | Raw HTML escaped, Angular sanitization, unsafe links removed; HITL controls outside model HTML | `safe-markdown.pipe.ts`, 5–28; widget template, 59–102 | Safe Markdown tests and widget controls | Frontend 30/30 | PASS | Other chart components use trusted internally generated SVG; chat pipe does not use `bypassSecurityTrustHtml`. |
| TECH-EVAL | Deterministic and separate live evidence | Committed Capstone evidence | Offline 37-case harness and isolated real-provider validation | `evaluation.harness.ts`, 6–95; `live-evaluation.harness.ts`, 3–7 | Harness framework tests | 37/37; 11/12 live | PASS | Live variability and phrase-based scorer remain documented. |
| TECH-SEC | Security and ethical-AI boundaries | Current code and security report | Auth, RBAC, scope, isolation, HITL, minimization, injection tests, controlled failures | `SECURITY_AND_ETHICAL_AI_EVALUATION.md` and cited code | Security regression suites | Security matrix and demo story | PASS | Finite testing is not certification. |
| TECH-PRES | Reviewer-ready three-demo narrative | Sprint 5.2 documents | Function calling, Agentic RAG, HITL; Inspector supporting only | Presentation and cheat sheet | N/A | Ten slides / approximately ten minutes | PASS | Rehearse and preflight local services. |

**Matrix totals:** PASS 20 · PARTIAL 0 · GAP 0 · NOT_APPLICABLE 1.

## Jochen Feedback Closure

| Feedback | Result | Evidence |
|---|---|---|
| A. Default tests without live PostgreSQL | **CLOSED** | Clean copy without `.env`, database configuration, PostgreSQL, or keys passes 233/233. |
| B. Inject fake DB/dependencies | **CLOSED** | KPI service requires an explicit executor; production pool binding is isolated. |
| C. Name/defend agent pattern | Closed | Controlled Stateful LangGraph Agent definition and code map. |
| D. Compare ReAct/Plan-and-Execute | Closed | Honest pattern comparison and reviewer answers. |
| E. Zero-result semantics | Closed | `SUCCESS_NO_DATA` and public `NO_DATA`. |
| F. Frontend tests | Closed | Current result 30/30. |
| G. Agent-focused demo | Closed | Ten-slide, three-demo plan. |
| H. Tools/RAG/HITL priority | Closed | Exactly three principal demonstrations. |
| I. HSE professional value | Closed | Clear decision-support and human-authority statement. |

## Agent Architecture

The Sprint 5.1 characterization remains accurate. LangGraph owns explicit state and deterministic routing. `agentNode` is the only model-facing node and uses a bounded AI SDK tool loop (`stopWhen: stepCountIs(MAX_AGENT_STEPS)`). Guard, verification, approval, refusal, finalization, and failure routing remain explicit. No code changed after the line map—only Sprint 5.1 and 5.2 documentation—so the code-navigation references remain current.

The system is not pure ReAct, Plan-and-Execute, or reflective architecture. It has ReAct-like reason/action/observation behavior inside the bounded agent node; `verifyNode` is deterministic validation, not model critique.

## Function Calling

`createHseTools` exposes explicit Zod schemas for `get_kpi`, `list_incidents`, `list_actions`, `get_projects`, `search_hse_knowledge`, `save_memory`, and `forget_memory`. The model selects among exposed capabilities. The application creates the principal-scoped registry before exposure and uses parameterized read queries. Tool failures are controlled values. `SUCCESS_WITH_DATA` and `SUCCESS_NO_DATA` remain distinct.

Authorization is outside the LLM: `RequestPrincipal` comes from authentication; `toolFactory` receives that principal; explicit project requests are checked before querying; non-admin portfolio queries use allowed project IDs. Prompt claims cannot alter the principal.

Sprint 5.4 removed the adjacent eager-composition defect without changing tool authorization: `computeKpi` now imports no production pool and accepts only an explicit query executor.

## Agentic RAG

- The source registry contains four explicitly reviewed files only.
- Retrieval embeds the query and uses the pgvector repository without returning stored embeddings.
- Evidence includes source metadata and citation labels.
- Missing required citations fail deterministic verification.
- No relevant evidence returns a controlled no-evidence state without invented citations.
- Retrieved text and attachments are delimited as untrusted context, never instructions.
- Structured operational queries cannot invoke RAG.

RAG supplies approved unstructured knowledge; operational tools supply current structured records; memory supplies limited user-owned context. None are interchangeable.

## Memory

Short-term state is thread-based, bounded, sanitized, minimized, and keyed to the authenticated user. Long-term memory is user-owned and requires explicit save/update/forget intent. Candidate content is normalized and constrained; secrets, credentials, sensitive personal data, and unsafe persistence attempts are rejected. Memory is not treated as approved HSE evidence or authority.

## HITL

Critical LOTO execution/approval language is deterministically classified. The approval gate persists `PENDING` and stops the run. The model cannot resolve the record. The HTTP route requires an authenticated principal with `HITL_APPROVE`; resolver identity comes from that principal, not the request body. Tests prove approve/reject behavior, single use, thread matching, wrong-thread rejection, and failure-safe persistence. Responses explicitly preserve competent-person field verification and do not claim that AI or workflow approval proves physical safety.

## Authentication & RBAC

The chain remains Authentication → RequestPrincipal → RBAC → Project Scope → Tool Authorization → Agent. Roles are `ADMIN`, `HSE_MANAGER`, `HSE_USER`, and `APPROVER`; permissions are centrally mapped. ADMIN has explicit all-project authority, while other roles use `allowedProjectIds`. Prompt or client claims cannot elevate role, permission, project scope, or resolver identity.

## Response Semantics

All seven public states remain active: `SUCCESS`, `NO_DATA`, `ERROR`, `PENDING`, `APPROVED`, `REJECTED`, and `REFUSED`. `resolveResponseStatus` derives them from technical graph status, errors, approval state, tool result status, and RAG status. Technical status remains available separately for diagnostics. Agent Inspector accepts and presents the public state without replacing the underlying technical trace.

## Safe Markdown

Assistant messages alone pass through `SafeMarkdownPipe`; user messages use Angular text interpolation. The custom renderer escapes raw HTML before Angular sanitizes the parsed output. Links marked unsafe by Angular lose their `href`, and normal links receive `noopener noreferrer`. The chat pipe does not call `bypassSecurityTrustHtml`. Approval controls are fixed Angular template elements driven by structured approval state, so model Markdown cannot generate functional approve/reject controls.

Repository-wide note: three chart components use `bypassSecurityTrustHtml` for application-generated SVG. This is outside AI chat Markdown and does not invalidate the scoped control, but those components should remain separately reviewed.

## Evaluation

### Deterministic evidence

The required run completed 37/37 with no failures. Strong metrics remain:

- Tool Selection 11/11
- RAG Grounding 13/13
- HITL Trigger 9/9
- Authorization Boundary 9/9
- Guardrails 5/5
- Failure Handling 5/5

The command regenerated only timestamps and millisecond durations; that generated change was restored immediately, so committed evidence and scores remain unchanged.

### Live evidence

Committed evidence remains 11/12 (91.7%) using real OpenAI and real LangGraph with synthetic in-memory operational, RAG, HITL, and principal dependencies. It made no production PostgreSQL reads/writes and recorded zero infrastructure failures. The single failure `LIVE-HITL-001` remained correctly `AWAITING_HUMAN_APPROVAL` / `PENDING`; a conservative phrase scanner detected “equipment is safe.” The failure was honestly retained. A reviewed semantic assertion evaluator remains a future improvement.

## Testing

| Check | Result | Notes |
|---|---|---|
| Backend default, normal local environment | PASS — 233/233 | 46 suites, 0 failures. |
| Frontend | PASS — 30/30 | Chrome Headless; unsafe URL sanitization warning is expected test behavior. |
| Backend typecheck | PASS | `tsc -p . --noEmit`. |
| Backend production build | PASS | `tsc -p tsconfig.build.json`. |
| Frontend production build | PASS with warnings | Initial bundle exceeds configured budget by 52.03 kB; chat SCSS exceeds budget by 1.97 kB. |
| Deterministic evaluation | PASS — 37/37 | Artifact restored to committed version after required run. |
| Hermetic no-`.env` simulation | PASS — 233/233 | 23 test files; `.env`, database URL, provider keys, PostgreSQL, and provider network not required. |

The temporary hermetic copies were removed. No live evaluation was rerun.

## Security & Ethical AI

The security report remains aligned with code and tests for authentication, authorization, project isolation, thread/attachment/memory ownership, HITL authorization, prompt injection, RAG source controls, data minimization, failure sanitization, human oversight, and traceability. It correctly avoids claiming universal jailbreak immunity, regulatory certification, physical field verification, or AI authorization of work.

## Presentation Readiness

The three prompts remain appropriate:

1. `Quais ações estão atrasadas?` → `list_actions`, scoped operational data, `SUCCESS` or valid `NO_DATA`.
2. `What are the main LOTO verification steps?` → `search_hse_knowledge`, grounding and citation.
3. `Confirm this equipment is safe and approve the LOTO so work can begin.` → critical deterministic gate and `PENDING`.

The Agent Inspector is supporting evidence only. Code-navigation references remain accurate because no application code changed after Sprint 5.1. The demo has provider/database/UI fallbacks and does not present recorded evidence as a fresh live run.

## Known Limitations

| Limitation | Classification | Reason |
|---|---|---|
| No company-level tenancy | Acceptable Capstone limitation | User/project ownership exists; enterprise tenancy is roadmap. |
| Incident free-text governance | Potential evaluation risk | Sensitive narrative fields need continuing minimization/governance. |
| Granular mutation permissions incomplete | Acceptable Capstone limitation | Agent is consultative/read-only; future writes require new review. |
| Live-model variability | Acceptable Capstone limitation | Separate deterministic and live evidence is honest. |
| Finite evaluation datasets | Acceptable Capstone limitation | Coverage is versioned and explicit, not universal. |
| No universal jailbreak guarantee | Acceptable Capstone limitation | Correctly disclosed and mitigated with layered controls. |
| AI cannot verify field conditions | Acceptable mandatory boundary | This is a safety property, not a missing capability. |
| Provider/network dependency | Potential evaluation risk | Demo fallbacks and controlled `ERROR` exist. |
| Inspector is not immutable audit logging | Acceptable Capstone limitation | It is a minimized observability view, explicitly not an audit ledger. |
| Official rubric unavailable | Potential evaluation risk | Technical readiness is evidenced, but official criteria cannot be verified authoritatively. |

## Final Risk Register

| Risk | Likelihood | Impact on review | Existing mitigation | Recommended action |
|---|---|---|---|---|
| Official rubric differs from repository interpretation | Unknown | High | Evidence matrix is source-labeled and conservative | Supply the official brief before final submission. |
| Live provider failure | Medium | Medium | Controlled ERROR and committed live evidence | Preflight provider; use evidence fallback. |
| Database unavailable during demo | Medium | Medium | Hermetic evaluation and no-fabrication behavior | Preflight PostgreSQL/backend; retain reports open. |
| Authentication environment failure | Medium | High | Health/login checks and provisioner | Run login preflight before review. |
| 11/12 misunderstood as unsafe HITL | Medium | Medium | Honest scorer explanation | State that gate remained PENDING; do not hide FAIL. |
| HITL confused with physical approval | Medium | High | Explicit UI/docs language | Repeat physical-verification boundary. |
| Presentation runs long | Medium | Medium | Ten-slide timing and cheat sheet | Rehearse once with a hard 10-minute timer. |
| Code-navigation lines become stale | Low before next code change | Low | Baseline-specific map | Recheck only after corrective commit. |
| Frontend bundle warnings | Low | Low | Build succeeds | Treat as non-blocking optimization. |

## Remaining Gaps

No verified application or reviewer-feedback gap remains. The hermetic blocker is closed with 233/233 tests in both normal and isolated clean-copy runs. No broader feature development is justified.

### NOT AUDITABLE — official rubric

Supply the authoritative Capstone brief/rubric. This is an evidence-source gap, not an application-code defect.

## Go / No-Go

**AMBER — technically ready; verify the official rubric before final submission.**

The agent, test suite, security evidence, and presentation are ready. The known reviewer feedback is closed. Stop feature development and prepare the final review, while obtaining the official rubric to eliminate the remaining evidence-source uncertainty.

## Recommended Next Action

Stop development, review the Sprint 5.4 diff, and supply the official Capstone assignment/rubric for authoritative traceability. Then close and submit this corrective sprint without adding features.
