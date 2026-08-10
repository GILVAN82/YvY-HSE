# YVY HSE — Turing College Sprint 3 Presentation Map V1

> **Sprint 6 final-state note (2026-08-10):** current validation authority is
> [`turing-sprint3-final-validation.md`](turing-sprint3-final-validation.md). Earlier totals and
> `PLANNED`/`PARTIAL` labels below are retained as planning history where not explicitly replaced.
> Final content readiness is 18/18 slides; visual evidence capture remains for Sprint 7.

Living presentation plan. Documentation status: 2026-08-08.

## Real UI integration validation — Sprint 4.2

A manual application test exposed an integration defect that backend-only smoke tests did not cover: the AI widget failed for `Quais ações estão atrasadas?`.

- **Audit:** traced Angular → `/api/ai/chat` → LangGraph → tool loop → PostgreSQL → SSE and identified broken UI thread reuse, incomplete Portuguese classification, missing explicit overdue semantics, collapsed error messages, and non-JSON PostgreSQL `Date` tool results.
- **Correction:** the widget now reuses `threadId`; the classifier recognizes Portuguese operational entities; `list_actions(overdue=true)` applies the shared business rule; operational dates are serialized to ISO; safe error codes are shown without raw details.
- **Architecture evidence:** operational data uses read-only PostgreSQL/domain tools; procedural knowledge uses RAG; critical LOTO approval remains behind HITL.
- **Demo prompt:** `Quais ações estão atrasadas?`
- **Expected visible result:** current operational action data from PostgreSQL, no RAG, with `list_actions` shown in trace metadata.
- **HTTP validation:** a harmless real `/api/ai/chat` request and same-thread follow-up pass when the server has the same network permission as the direct runner. An HTTP integration test also proves SSE, thread reuse and a synthetic `list_actions` tool loop.
- **Root cause evidence:** safe fingerprinting isolated the earlier HTTP-only failure to sandbox network denial (`EACCES`), not LangGraph, model selection, history, tool schemas or SSE.
- **Validation boundary:** live egress of real action/incident rows to an external model still requires explicit authorization before the operational-data demo is marked complete.
- **Data minimization:** `list_actions` constructs a seven-field outbound allowlist (`actionId`, `description`, `status`, `targetDate`, `daysOverdue`, `priority`, `sourceModule`). Responsible-person and unexpected database fields are excluded deterministically before the model boundary.
- **Operational demo flow:** User → LangGraph → `list_actions(overdue=true)` → PostgreSQL → minimized operational result → response. `RAG USED: NO`.

Source note: `docs/turing-sprint3-agentic-rag-audit.md` does not exist. Its authoritative
equivalent is the reviewed report set in `docs/turing-sprint3-rag-audit/`, especially
`00_RAG_EXECUTIVE_SUMMARY.md`. Later completed sprint documents supersede older “not yet
implemented” statements retained in historical audit/architecture sections.

## 1. Verified architecture snapshot

| Layer | Verified implementation |
|---|---|
| Frontend | Angular 18 |
| Backend/API | Node.js, Express, TypeScript, SSE |
| Agent orchestration | LangGraph |
| Model used in verified live demonstrations | OpenAI |
| Embeddings | `text-embedding-3-small`, 1536 dimensions |
| Database | PostgreSQL 16.14 |
| Vector extension | pgvector 0.8.6 |
| RAG corpus | 4 approved documents, 4 chunks, 4 embeddings |
| Thread state | PostgreSQL `agent_thread_state`, latest 30 messages |
| Long-term memory | PostgreSQL `agent_long_term_memory`, explicit and allowlisted |
| HITL | PostgreSQL `agent_human_approval`, application-level persisted pause |
| Operational HSE data | 42 tables, 784 rows preserved |
| Automated tests | 125/125 passing |

Overall flow:

`Angular → Express API → LangGraph → OpenAI / RAG / SQL tools → PostgreSQL + pgvector`

## 2. Presentation story

```text
PROBLEM
  ↓
EXISTING YVY HSE APPLICATION
  ↓
WHY AN AI AGENT
  ↓
LANGGRAPH ARCHITECTURE
  ↓
AGENTIC RAG
  ↓
STATE / MEMORY
  ↓
HUMAN-IN-THE-LOOP
  ↓
SAFETY / HARNESS
  ↓
EVALUATION
  ↓
RESULTS
  ↓
LIMITATIONS
  ↓
FINAL ARCHITECTURE
```

The central story is not “we added a chatbot.” It is: **we separated structured operational data, approved reference knowledge, conversation state, durable memory, and human authority, then gave each one a controlled path.**

## 3. Proposed slide plan — 18 slides

### Slide 1 — YVY HSE Agentic AI

- **Purpose:** Introduce the project and scope.
- **Key message:** An existing HSE application now has a controlled AI agent architecture.
- **Visual to prepare:** Title over a clean screenshot of the YVY HSE application.
- **What to say:** “This project extends an existing HSE management system. The goal is useful AI assistance without losing control of data, evidence, or safety decisions.”
- **Simple English talk track:** “I built an AI agent around the existing YVY HSE application. It can use data and documents, but important safety controls stay deterministic and human-controlled.”
- **Live demo:** None.
- **Technical evidence:** `docs/architecture.md`; application screenshot.
- **Status:** READY.

### Slide 2 — Problem and HSE context

- **Purpose:** Explain why a normal chatbot is not enough.
- **Key message:** HSE questions mix exact operational facts, reference guidance, and accountable decisions.
- **Visual to prepare:** Three question cards: incident count, LOTO precautions, approve LOTO.
- **What to say:** Counts need SQL, procedures need document evidence, and critical approval needs a human. One undifferentiated prompt would be unsafe and unreliable.
- **Simple English talk track:** “Different questions need different controls. A count is a database question. A procedure is a document question. A critical approval is a human decision.”
- **Live demo:** Preview Demos 1, 2, and 7.
- **Technical evidence:** RAG audit classification; HITL policy documentation.
- **Status:** READY.

### Slide 3 — The existing YVY HSE application

- **Purpose:** Show that AI was added to a real application and database.
- **Key message:** Angular and Express already serve operational HSE modules backed by PostgreSQL.
- **Visual to prepare:** Application screenshot plus Angular/Express/PostgreSQL labels.
- **What to say:** The original system has 42 operational tables and 784 rows. The AI work preserved them rather than copying all records into a vector index.
- **Simple English talk track:** “The project started with a working Angular and Express application. The PostgreSQL database already contained 42 HSE tables and 784 operational rows.”
- **Live demo:** Brief application navigation if time permits.
- **Technical evidence:** `docs/architecture.md`; pgvector setup validation.
- **Status:** READY.

### Slide 4 — Why an agentic architecture

- **Purpose:** Justify LangGraph and tools.
- **Key message:** Explicit states and routing are needed for guards, tools, verification, refusal, and approval.
- **Visual to prepare:** Compare “single prompt” with “controlled state graph.”
- **What to say:** LangGraph decides what happens next; the Vercel AI SDK handles model streaming and typed tool calls. Express remains the API boundary.
- **Simple English talk track:** “A single model call cannot show clear control. LangGraph gives named steps and decisions. The AI SDK handles the model and tools.”
- **Live demo:** None.
- **Technical evidence:** `docs/langgraph-architecture.md`; graph tests.
- **Status:** READY.

### Slide 5 — LangGraph control flow

- **Purpose:** Explain the agent lifecycle.
- **Key message:** Every request passes guard, agent, verify, and—when critical—approval gate.
- **Visual to prepare:** Diagram B.
- **What to say:** Guard can refuse before model cost. Agent can call tools. Verify checks output and RAG citations. Critical LOTO approval pauses before finalization.
- **Simple English talk track:** “The request first passes a guard. The agent can use tools. Verify checks the result. A critical action goes to the approval gate.”
- **Live demo:** Demo 7 later.
- **Technical evidence:** `hseAgent.graph.ts`; guard, verify and HITL tests.
- **Status:** READY.

### Slide 6 — Agentic RAG architecture

- **Purpose:** Show that retrieval is a controlled agent tool.
- **Key message:** The agent decides when approved document knowledge is needed, then receives ranked evidence.
- **Visual to prepare:** Diagram C.
- **What to say:** The query is embedded, pgvector runs cosine retrieval, Top-K evidence returns traceability metadata, and verification requires a real citation label.
- **Simple English talk track:** “RAG is a tool, not a hidden database scan. The tool finds approved evidence, and the answer must use the real citation returned by retrieval.”
- **Live demo:** Demo 1.
- **Technical evidence:** Retrieval service/repository tests; `turing-sprint3-rag-retrieval.md`.
- **Status:** READY.

### Slide 7 — Knowledge base and pgvector

- **Purpose:** Explain corpus quality, ingestion, and database choice.
- **Key message:** Four small, reviewed summaries are better than fabricated or sensitive content.
- **Visual to prepare:** Four source cards feeding 4 document/4 chunk rows in PostgreSQL.
- **What to say:** The original audit found operational tables, not a defensible document corpus. Four approved curated summaries were later onboarded with an allowlist, hashes, metadata, and idempotent ingestion.
- **Simple English talk track:** “We did not embed all company data. We approved four reference summaries and stored one chunk for each document.”
- **Live demo:** Optional pgvector evidence screen.
- **Technical evidence:** Ingestion document; 4 documents, 4 chunks, 4 embeddings; pgvector 0.8.6.
- **Status:** READY.

### Slide 8 — Structured data versus document knowledge

- **Purpose:** Demonstrate deliberate routing.
- **Key message:** Procedures use RAG; counts, status, dates, and operational records use SQL/tools.
- **Visual to prepare:** Diagram D with two branches.
- **What to say:** Similarity search should not answer “how many incidents.” The structured-query classifier blocks RAG before embedding.
- **Simple English talk track:** “We use RAG only for document knowledge. Operational data stays in PostgreSQL and is accessed through tools.”
- **Live demo:** Demo 2.
- **Technical evidence:** `NOT_APPROPRIATE` structured query test; SQL tool registry.
- **Status:** READY for routing; operational tool coverage is PARTIAL.

### Slide 9 — Retrieval, no-evidence behavior, and citations

- **Purpose:** Show grounding and graceful failure.
- **Key message:** Relevant evidence is traceable; missing evidence produces no fabricated citation.
- **Visual to prepare:** Ranked result with source ID/citation label and a separate `NO_RELEVANT_EVIDENCE` card.
- **What to say:** Default Top-K is 3 and verified threshold is 0.45. Verification rejects a RAG answer without a matching citation label.
- **Simple English talk track:** “If the source is relevant, the answer cites it. If no source passes the threshold, the system says no evidence instead of inventing a citation.”
- **Live demo:** Demos 1 and 3.
- **Technical evidence:** Live retrieval scores 0.5094–0.6335; no-evidence and citation tests.
- **Status:** READY.

### Slide 10 — Three types of context

- **Purpose:** Prevent confusion between RAG, state, and memory.
- **Key message:** Each context type has a different lifecycle and authority.
- **Visual to prepare:** Three-column comparison from Section 8.
- **What to say:** RAG is reference knowledge, thread state continues one conversation, and long-term memory is explicit durable context across threads.
- **Simple English talk track:** “RAG, thread state, and memory are not the same. One finds documents, one continues a conversation, and one stores an approved durable preference.”
- **Live demo:** Transition to Demos 4–6.
- **Technical evidence:** State and memory documentation.
- **Status:** READY.

### Slide 11 — Persistent thread state and isolation

- **Purpose:** Explain multi-turn continuity without cross-thread leakage.
- **Key message:** A validated thread UUID restores a bounded 30-message window from PostgreSQL.
- **Visual to prepare:** Diagram E.
- **What to say:** Thread A can continue LOTO. Thread B independently retrieves emergency knowledge. Secrets, vectors, chunks, prompts, and raw tool results are not checkpointed.
- **Simple English talk track:** “The same thread remembers recent conversation context. A different thread starts independently. We tested that LOTO context does not leak into the emergency thread.”
- **Live demo:** Demos 4 and 5.
- **Technical evidence:** Thread isolation and live multi-turn tests; `agent_thread_state`.
- **Status:** READY.

### Slide 12 — Controlled long-term memory

- **Purpose:** Show durable context without automatic profiling.
- **Key message:** Memory requires explicit intent, validation, relevance filtering, and forget semantics.
- **Visual to prepare:** Diagram F.
- **What to say:** Normal conversation is not saved. Allowed categories are workflow preference, project context, operating constraint, and domain preference. No embeddings are used.
- **Simple English talk track:** “The user must explicitly ask the system to remember something. Normal messages do not become permanent memory. The memory can also be forgotten.”
- **Live demo:** Demo 6.
- **Technical evidence:** `agent_long_term_memory`; duplicate/update/forget/security tests.
- **Status:** READY.

### Slide 13 — Human-in-the-Loop for critical LOTO approval

- **Purpose:** Demonstrate the boundary between advice and authority.
- **Key message:** AI may analyze, recommend, retrieve, and verify; it cannot autonomously approve LOTO execution.
- **Visual to prepare:** Diagram G plus PENDING/APPROVED/REJECTED states.
- **What to say:** A deterministic policy routes critical LOTO approval to a persisted approval gate. A separate controlled path records APPROVE or REJECT once for the matching thread.
- **Simple English talk track:** “The AI can provide an analysis, but it cannot approve a critical LOTO action. The workflow pauses and waits for a human decision.”
- **Live demo:** Demo 7.
- **Technical evidence:** `agent_human_approval`; HITL tests and smoke output.
- **Status:** READY as workflow semantics; production identity/UI is PARTIAL.

### Slide 14 — Current safety controls and Agent Harness

- **Purpose:** Present defense in depth and distinguish implemented controls from next-phase harness work.
- **Key message:** Existing safety controls are now exercised through a versioned deterministic evaluation harness.
- **Visual to prepare:** Shield layers: input, tools/data, output, state/memory, human gate.
- **What to say:** Current controls include guard/refusal, verification, allowlisted ingestion, untrusted evidence, jurisdiction warnings, isolation, redaction, operational minimization, memory policy, and HITL. Sprint 5 adds a 28-case versioned dataset, normalized observations, named checks, safe reports, and category-level regression results.
- **Simple English talk track:** “Safety is implemented in several layers. The Agent Harness now runs reviewed cases around the real agent and reports exactly which control passed or failed.”
- **Live demo:** Prompt-injection refusal if time permits.
- **Technical evidence:** `turing-sprint3-agent-harness.md`; evaluation dataset/harness; focused integration tests.
- **Status:** READY for deterministic regression; broader evaluation metrics PARTIAL.

### Slide 15 — Evaluation and testing

- **Purpose:** Show evidence without overstating quality metrics.
- **Key message:** 125 automated tests plus controlled live smoke tests validate behavior and regressions.
- **Visual to prepare:** Test summary screenshot and capability checklist.
- **What to say:** Tests cover graph flow, tools, RAG, citation grounding, routing, state, memory, HITL, failures, and isolation. Accuracy, cost, latency, and benchmark metrics have not been established.
- **Simple English talk track:** “The current evaluation is based on automated behavior tests and controlled live smoke tests. We do not claim accuracy or performance metrics that we have not measured.”
- **Live demo:** Show test result evidence, not rerun unless requested.
- **Technical evidence:** 145/145 backend and 3/3 frontend passing; pgvector rollback validation; 28/28 Agent Harness scenarios across 13 categories.
- **Status:** Regression tests READY; formal evaluation dataset/metrics PLANNED.

### Slide 16 — Verified technical results

- **Purpose:** Summarize objective outcomes.
- **Key message:** The architecture works and preserves the original HSE database.
- **Visual to prepare:** Results scorecard.
- **What to say:** PostgreSQL 16.14, pgvector 0.8.6, 4/4/4 RAG counts, 1536 dimensions, thread and memory persistence, no cross-thread leakage, HITL pass, 42 tables and 784 rows preserved, 125/125 tests.
- **Simple English talk track:** “All verified components passed. The original 42 HSE tables and 784 rows were preserved.”
- **Live demo:** None.
- **Technical evidence:** Sprint documents and validation outputs.
- **Status:** READY.

### Slide 17 — Limitations and production gaps

- **Purpose:** Demonstrate technical honesty.
- **Key message:** This is a strong prototype, not a production multi-user safety approval system.
- **Visual to prepare:** Implemented versus required-for-production table.
- **What to say:** Authentication, RBAC, tenant isolation, RLS, approver identity, full operational tool coverage, native PostgreSQL LangGraph command resume, and automatic HITL expiry are absent.
- **Simple English talk track:** “The workflow is controlled, but it does not verify who the human approver is. Production use needs authentication, authorization, tenant isolation, and stronger audit controls.”
- **Live demo:** None.
- **Technical evidence:** Limitations in state, memory, and HITL documents.
- **Status:** READY.

### Slide 18 — Final architecture and next phase

- **Purpose:** Close with the integrated system and roadmap.
- **Key message:** The system combines controlled agent flow, RAG, tools, state, memory, verification, HITL, and a versioned regression harness.
- **Visual to prepare:** Diagram H.
- **What to say:** Revisit the original problem and show where each control now lives. End with the implemented deterministic harness and the remaining work for broader datasets and semantic/provider metrics.
- **Simple English talk track:** “The final design separates knowledge, operational data, conversation state, durable memory, and human authority. The next phase is a formal safety and evaluation harness.”
- **Live demo:** Optional recap of demo outputs.
- **Technical evidence:** Architecture documentation and evidence matrix.
- **Status:** Current architecture and Agent Harness / Safety / Evaluation READY; production security controls remain future work.

## 4. Diagram production map

| ID | Diagram | Required flow | Suggested format | Status |
|---|---|---|---|---|
| A | Overall YVY HSE architecture | Angular → Express → LangGraph → OpenAI/RAG/tools → PostgreSQL + pgvector | Layered architecture | PLANNED |
| B | LangGraph agent | User → Guard → Agent → Verify → Approval Gate → Finalize; Guard → Refuse; failures → controlled failure | Flowchart | PLANNED |
| C | Agentic RAG | Question → Agent → RAG tool → embedding → pgvector cosine retrieval → Top-K evidence → Agent → Verify → citation | Sequence/flow | PLANNED |
| D | Knowledge routing | Procedures/policies/guidance → RAG; counts/status/records → SQL tools | Decision tree | PLANNED |
| E | Thread state | Thread A ↔ PostgreSQL restore; Thread B ↔ independent row/state | Isolation diagram | PLANNED |
| F | Long-term memory | Remember → validate → save → new-thread retrieval → Forget | Lifecycle | PLANNED |
| G | HITL | Critical action → analysis → gate → PENDING → human APPROVE/REJECT → resume/stop | State flow | PLANNED |
| H | Final agent architecture | Guard + Agent + tools/RAG + state/memory + Verify + HITL + Finalize | Integrated system diagram | PLANNED |

Do not create diagram assets until the presentation visual style is selected. The flows above are the source specifications.

## 5. Live demo plan and fallback evidence

### Demo 1 — RAG grounding

- **Ask:** “What precautions should be taken before performing lockout/tagout?”
- **Expected:** `search_hse_knowledge` used; LOTO source retrieved; real citation shown; grounded answer.
- **Presenter note:** Point to the tool event, source label, and jurisdiction wording.
- **Fallback:** Retrieval smoke output with `yvy-kb-loto-osha-1910-147`; automated RAG citation test; later capture of successful citation screen; Diagram C.

### Demo 2 — Structured routing

- **Ask:** “How many incidents are currently open?”
- **Expected:** RAG is not offered/used; route remains SQL/tools.
- **Presenter note:** Explain why similarity search is wrong for exact operational counts. Do not promise that every operational query/tool is complete.
- **Fallback:** `NOT_APPROPRIATE` automated test and smoke output; Diagram D; tool registry evidence.

### Demo 3 — No relevant evidence

- **Ask:** “What is the company vacation policy?”
- **Expected:** `NO_RELEVANT_EVIDENCE`; no fabricated citation.
- **Fallback:** Live retrieval smoke output; no-evidence unit test; verifier fake-citation rejection test.

### Demo 4 — Thread continuity

- **Thread A, turn 1:** “What precautions should be taken before performing lockout/tagout?”
- **Thread A, turn 2:** “What about restoring energy afterward?”
- **Expected:** Same UUID restores LOTO context and may retrieve LOTO evidence again.
- **Fallback:** State smoke results A1/A2/A3; same-thread restore test; Diagram E.

### Demo 5 — Thread isolation

- **Thread B:** “What should an emergency procedure define?”
- **Expected:** Emergency evidence; no Thread A LOTO messages or citations.
- **Fallback:** Live state smoke summary with `crossThreadCitationLeakage:false`; isolation test; later paired Thread A/B screenshots.

### Demo 6 — Controlled long-term memory

- **Thread A:** “Remember that for this YVY HSE project PostgreSQL is the persistence database.”
- **New thread:** “Which persistence database should this project use?”
- **Expected:** Relevant PostgreSQL memory recovered without Thread A transcript.
- **Then:** Forget and show zero matching memory in a later thread.
- **Fallback:** Memory smoke output; cross-thread/forget tests; Diagram F. Never use real secrets in a demo memory.

### Demo 7 — HITL

- **Ask:** “Approve this LOTO as safe for execution.”
- **Expected:** Advisory analysis then `AWAITING_HUMAN_APPROVAL` / PENDING.
- **Controlled internal decision:** APPROVE → APPROVED, explicitly human authorization.
- **Second request:** REJECT → REJECTED, action remains stopped.
- **Fallback:** HITL smoke output; pending/approve/reject/single-use/thread-isolation tests; Diagram G. The current live model may not call RAG for this terse prompt; do not claim it did unless visible.

### Demo environment fallback ladder

| Failure | Response during presentation |
|---|---|
| OpenAI/API or internet unavailable | Use captured successful outputs later, automated mocked-model tests, and diagrams. Explain that automated tests require no live OpenAI. |
| PostgreSQL unavailable | Use validation output/screenshots captured beforehand and repository tests. Do not simulate a successful live database write. |
| Docker unavailable | Use pgvector validation evidence and the documented PostgreSQL/extension versions. |
| Live model chooses different tools/wording | Explain nondeterministic model behavior, then show deterministic routing/gate tests and smoke evidence. |
| Complete live app unavailable | Present architecture diagrams, verified screenshots captured beforehand, and 125/125 test evidence. |

No screenshot is claimed as existing until it is captured from a real successful run.

## 6. Evidence matrix

| Capability | Why it exists | Implementation | Test evidence | Live demo | Documentation | Status |
|---|---|---|---|---|---|---|
| LangGraph | Explicit control flow | Typed StateGraph and nodes | Agent flow tests | Indirect in all demos | Architecture + LangGraph docs | READY |
| Guard / refusal | Stop invalid/injection requests early | Guard node + refusal path | Guard/refusal suite | Optional injection demo | LangGraph architecture | READY |
| Verify | Reject empty/failing/ungrounded outputs | Verify node | Empty, step, RAG citation tests | Demo 1 | RAG retrieval doc | READY |
| RAG | Reusable document guidance | `search_hse_knowledge` | RAG graph/retrieval tests | Demo 1 | RAG ingestion/retrieval docs | READY |
| pgvector | Vector similarity inside existing DB | PostgreSQL extension + vector(1536) | Rollback/FK/vector validation | Optional evidence screen | pgvector setup | READY |
| Embeddings | Semantic query/chunk representation | `text-embedding-3-small` | Dimension/config tests | Demo 1 | Ingestion doc | READY |
| Retrieval | Ranked relevant evidence | Cosine `<=>`, Top-K 3, threshold 0.45 | Relevant/no-evidence/repository tests | Demos 1, 3 | Retrieval doc | READY |
| Citations | Traceability and anti-hallucination | Source metadata + verifier | Grounded/missing/fake citation tests | Demo 1 | Retrieval doc | READY |
| Structured routing | Keep exact data out of RAG | Deterministic classifier + SQL tools | `NOT_APPROPRIATE` tests | Demo 2 | Retrieval doc | READY; tool breadth PARTIAL |
| Thread state | Multi-turn continuity | `agent_thread_state` | Restore/recovery tests | Demo 4 | State doc | READY |
| Thread isolation | Prevent context leakage | Validated UUID lookup | A/B isolation tests | Demo 5 | State doc | READY |
| Long-term memory | Explicit cross-thread context | `agent_long_term_memory` | Policy/cross-thread tests | Demo 6 | Memory doc | READY |
| Memory forget | Lifecycle control | Disable/internal cleanup | Forget test/smoke | Demo 6 | Memory doc | READY |
| HITL | Keep critical authority human | Approval gate + persisted decision | 13 HITL tests | Demo 7 | HITL doc | READY prototype; identity PARTIAL |
| Prompt-injection defense | Protect system/tool policy | Guard + untrusted evidence/memory | Injection tests | Optional | RAG/memory/HITL docs | READY |
| Jurisdiction safeguard | Avoid false legal applicability | Prompt + source metadata | RAG behavior tests | Demo 1 | Retrieval doc | READY |
| Evaluation | Detect behavioral regressions | Node test suite + smoke CLIs + Agent Harness | 154/154 backend; 7/7 frontend; offline 36/36; live-safe 9/9 | Slide 15 | Sprint docs + Agent Harness doc | READY; exact-ID cleanup PASS |
| Agent Harness | Unify safety/evaluation scenarios and regression evidence | Versioned cases + deterministic observation checks + JSON/Markdown reports | Focused harness and graph-integration tests | Test/report evidence | Agent Harness document | READY |

## 7. Verified results scorecard

| Result | Value |
|---|---|
| LangGraph | PASS |
| Agentic RAG | PASS |
| PostgreSQL | 16.14 |
| pgvector | 0.8.6 |
| RAG documents / chunks / embeddings | 4 / 4 / 4 |
| Embedding dimensions | 1536 |
| Thread persistence | PASS |
| Cross-thread leakage | NO |
| Controlled long-term memory | PASS |
| Normal conversations automatically remembered | NO |
| HITL workflow | PASS |
| Human identity verified | NO |
| Operational HSE tables | 42 |
| Operational rows | 784 preserved |
| Automated tests | 154/154 backend; 7/7 frontend; 5/5 focused harness |

No latency, accuracy, cost, quality-score, or performance claim is currently supported.

## 8. Three types of context — slide-ready comparison

| | RAG | Thread state | Long-term memory |
|---|---|---|---|
| Purpose | Reference HSE knowledge | Continue one conversation | Reuse explicitly approved durable context |
| Scope | Approved documents | One thread UUID | Application/project-level across threads |
| Creation | Controlled source onboarding and ingestion | Successful conversation turns | Explicit “remember” intent plus policy validation |
| Retrieval | Semantic pgvector search | Exact thread UUID restore | Lightweight relevant key/content lookup |
| Lifetime | Until source re-index/removal policy | Latest 30 messages; resettable | Until update/forget/delete |
| Stores embeddings? | Yes, only in RAG chunks | No | No |
| Example | LOTO precautions | “What about restoring energy?” | “This project uses PostgreSQL.” |
| Authority | Untrusted reference evidence | Conversation context | Untrusted contextual data |

Slide sentence: **“RAG finds knowledge, thread state continues the current conversation, and long-term memory carries only explicit durable context into a new conversation.”**

## 9. Safety mechanisms evaluated by Sprint 5

| Safety layer | Implemented mechanism |
|---|---|
| Input | Zod request limits, guard node, prompt-injection refusal, rate limit |
| Provider/tool policy | Server model allowlist, bounded steps, timeout, read-only parameterized tools |
| Knowledge ingestion | Explicit source allowlist, sensitivity checks, controlled files, deterministic hashes, transactional writes |
| Retrieval | Structured-query bypass, threshold/no-evidence status, vectors never returned |
| Evidence | Retrieved text treated as untrusted; exact citation labels; jurisdiction warnings |
| Output | Verify node checks non-empty result, limits, tool failure, and RAG traceability |
| Thread state | UUID isolation, bounded history, secret redaction, no vectors/chunks/raw tool results |
| Long-term memory | Explicit intent, category allowlist, size cap, secret/sensitive/injection rejection, forget |
| HITL | Deterministic critical-action gate, PENDING pause, human-only controlled path, single use, wrong-thread prevention |

Sprint 5 exercises these controls through 28 reusable cases, structured expectations, named checks, safe reports and category results. The real Sprint 4.2 operational flow and its `project="*"` defect/regression provide live engineering evidence. Semantic/provider-scale quality metrics remain future work and are not represented as “AI accuracy”.

## 10. Current limitations — show openly

| Area | Current status | Consequence / next control |
|---|---|---|
| Authentication | NOT IMPLEMENTED | No verified user session or identity |
| RBAC | NOT IMPLEMENTED | No role-based permission to approve or access memory |
| Tenant isolation | NOT IMPLEMENTED | State/memory are not safe for multiple companies |
| Row-level security | NOT IMPLEMENTED | PostgreSQL does not enforce per-user/per-tenant ownership |
| Verified human approver identity | NOT IMPLEMENTED | HITL proves decision semantics, not who approved |
| Operational SQL tools | NOT YET FULLY IMPLEMENTED | Existing tools cover selected queries, not every HSE workflow |
| HITL resume | Application-level persisted pause | Not native PostgreSQL LangGraph `Command` checkpoint resume |
| Pending approval expiry | NOT AUTOMATIC | PENDING records require future cancellation/expiry policy |
| RAG corpus | Four curated summaries | Useful demonstration, not a full controlled-document library |
| Formal evaluation dataset/metrics | READY | 36/36 deterministic scenarios; metric is scenario pass rate, not broad AI accuracy |

## 11. Turing concept mapping

| Turing concept | YvY implementation | Evidence status |
|---|---|---|
| AI Agent | LangGraph orchestration around the HSE assistant | READY |
| Agent architecture | Guard / Agent / Verify / Approval Gate / Finalize / Refuse | READY |
| Tool use | Typed RAG and operational SQL tools | READY / operational breadth PARTIAL |
| RAG | OpenAI embeddings + PostgreSQL pgvector | READY |
| State management | PostgreSQL thread state | READY |
| Long-term memory | Controlled `agent_long_term_memory` | READY |
| HITL | Approval gate + persisted APPROVE/REJECT decision | READY prototype |
| Safety | Guardrails, evidence controls, memory policy, HITL and domain scope | READY; formal harness 36/36 |
| Evaluation | Automated tests + controlled smoke tests + versioned Agent Harness | READY |
| Agent Harness | Unified deterministic safety/regression framework | Sprint 5 COMPLETE: offline 28/28; live-safe 8/9 recorded without retry; exact-ID cleanup PASS |

## 12. Reviewer Q&A

### Why LangGraph?

- **Short answer:** It gives explicit states and routing for guard, tools, verification, refusal, and HITL.
- **Detailed answer:** A single prompt or loop would hide control decisions. LangGraph makes the lifecycle visible and testable. The model call remains inside one agent node, while deterministic nodes enforce input guard, output verification, and critical approval routing.

### Why PostgreSQL?

- **Short answer:** The application already uses PostgreSQL, and it can store operational data, vectors, thread state, memory, and approval audit rows safely in separate tables.
- **Detailed answer:** Reusing PostgreSQL avoids another service and operational burden. Additive migrations keep RAG, state, memory, and approvals isolated from the 42 original HSE tables. Transactions, foreign keys, JSONB, and parameterized queries support the required controls.

### Why pgvector?

- **Short answer:** It provides vector similarity in the existing PostgreSQL database.
- **Detailed answer:** The corpus is tiny, so exact cosine search is sufficient. pgvector keeps document metadata and vectors together, supports 1536-dimensional embeddings, and avoids operating a separate vector database. HNSW is unnecessary without measured scale or latency need.

### Why only four documents?

- **Short answer:** Only four reviewed, non-sensitive reference summaries were approved.
- **Detailed answer:** The audit found that the original system mostly contains structured operational rows, not reusable document bodies. Fabricating procedures would be unsafe. The project therefore onboarded a small truthful corpus with source IDs, version, jurisdiction, URLs, hashes, and citation labels.

### Why not embed all 784 HSE records?

- **Short answer:** They are operational records that need exact SQL, and some contain sensitive fields.
- **Detailed answer:** Counts, dates, statuses, and record filters are deterministic database questions. Embedding those rows would make exact answers approximate, increase leakage risk, and mix current operational truth with reference knowledge. The routing policy keeps them in SQL/tools.

### Why not MySQL?

- **Short answer:** The existing application already uses PostgreSQL, and pgvector integrates directly with it.
- **Detailed answer:** Changing databases would add migration risk without solving a project need. PostgreSQL supports the operational schema, transactions, JSONB, UUIDs, and vector search in one platform. The original 42 tables and 784 rows were preserved.

### Why not Chroma or Pinecone?

- **Short answer:** A separate vector service is unnecessary for four chunks.
- **Detailed answer:** External vector infrastructure would add credentials, deployment, data synchronization, cost, and another security boundary. pgvector provides the required exact cosine search inside the database already operated by the project.

### What is the difference between RAG and memory?

- **Short answer:** RAG retrieves approved reference documents; memory stores selected durable project context.
- **Detailed answer:** RAG content has provenance, citation, version, and jurisdiction and remains the authority for reference knowledge. Long-term memory is explicit, capped, removable context such as a workflow preference. Memory never replaces RAG or operational data.

### What is the difference between thread state and long-term memory?

- **Short answer:** Thread state continues one conversation; long-term memory can be reused in a new thread.
- **Detailed answer:** Thread state is keyed by a conversation UUID and stores only the latest 30 messages plus minimal source references. Long-term memory requires explicit user intent and policy validation, and it is retrieved only when relevant across independent threads.

### Why does not every conversation become memory?

- **Short answer:** Automatic memory would create privacy, relevance, and stale-data risks.
- **Detailed answer:** The `save_memory` tool is available only after explicit remember intent. Categories, size, content, secrets, sensitive data, operational records, and prompt injection are validated. Normal conversation remains temporary thread state.

### How do you prevent prompt injection?

- **Short answer:** A guard blocks common user attacks, and retrieved evidence and memory are explicitly treated as untrusted data.
- **Detailed answer:** Input rules can refuse before the model. RAG and memory cannot change system policy or authorize tools. Critical HITL classification is deterministic, so words like “approved” inside documents or memory cannot resolve an approval.

### How do you prevent hallucination?

- **Short answer:** The agent uses tools, real metadata citations, and a no-evidence result instead of inventing sources.
- **Detailed answer:** RAG answers must contain an actual returned citation label. Verification rejects missing or fabricated citation patterns. Structured facts stay in SQL tools. This reduces hallucination risk, but it does not prove every sentence is semantically correct; broader evaluation is planned.

### What happens when no relevant document exists?

- **Short answer:** Retrieval returns `NO_RELEVANT_EVIDENCE`, and the agent must not invent a citation.
- **Detailed answer:** Evidence below the configured threshold is excluded. The prompt instructs the model to state the evidence gap, and deterministic verification rejects source-like citations when retrieval found nothing.

### Why does RAG not answer incident-count questions?

- **Short answer:** Counts are exact structured data, not semantic document knowledge.
- **Detailed answer:** The classifier detects current/count/status operational questions before embedding and withholds the RAG tool. The correct architecture is a parameterized SQL tool querying the operational database.

### How does HITL work?

- **Short answer:** A critical LOTO approval request pauses as PENDING until a separate controlled APPROVE or REJECT decision is recorded.
- **Detailed answer:** After normal analysis and verification, a deterministic approval gate creates a minimal PostgreSQL audit row tied to the thread. Atomic resolution requires both the approval UUID and matching thread UUID and works only once.

### Can the AI approve LOTO by itself?

- **Short answer:** No.
- **Detailed answer:** The model can analyze, retrieve reference guidance, and recommend. It cannot resolve the PENDING approval. RAG text, memory, and prompt injection cannot bypass the deterministic gate or call the internal human decision path.

### Who is the human approver?

- **Short answer:** The prototype does not verify or record a human identity.
- **Detailed answer:** There is no authentication or ownership model. The controlled service/CLI demonstrates approval workflow semantics only. Production must add authenticated identity, role authorization, ownership, and auditable approver attribution.

### Why is approver identity not available?

- **Short answer:** Authentication and RBAC are outside the current implemented scope.
- **Detailed answer:** Inventing an `approvedByUserId` would falsely imply verified identity. The schema deliberately records the decision and timestamps without claiming who made it. This limitation is explicit in the presentation.

### What production security controls remain?

- **Short answer:** Authentication, RBAC, tenant isolation, RLS, verified approval identity, expiry, and stronger audit controls.
- **Detailed answer:** The system is not ready for multi-company or sensitive production deployment. It also needs broader operational tool authorization, retention/deletion policies, same-thread concurrency controls, monitoring, and a formal safety/evaluation harness.

## 13. Asset checklist

| Asset | Status | How to capture |
|---|---|---|
| YVY HSE application screenshot | NEEDS_CAPTURE | Open the real Angular app at localhost, choose a representative dashboard, hide any sensitive data, capture browser only. |
| Overall architecture | PLANNED | Produce Diagram A from the approved flow after slide visual style is selected. |
| LangGraph diagram | PLANNED | Produce Diagram B with refusal and failure paths. |
| RAG diagram | PLANNED | Produce Diagram C including citation verification. |
| RAG citation screenshot | NEEDS_CAPTURE | Run Demo 1 successfully and capture the tool/citation result. |
| Structured routing evidence | NEEDS_CAPTURE | Capture Demo 2 plus `NOT_APPROPRIATE` test/smoke evidence. |
| No-evidence screenshot | NEEDS_CAPTURE | Run Demo 3 and capture no citation. |
| Thread A continuity screenshot | NEEDS_CAPTURE | Capture both LOTO turns with the same thread identifier/context. |
| Thread B isolation screenshot | NEEDS_CAPTURE | Capture emergency response in a new thread; pair with isolation test evidence. |
| Long-term memory save/retrieve screenshot | NEEDS_CAPTURE | Run remember → new thread → retrieve with non-sensitive test content. |
| Long-term memory forget screenshot | NEEDS_CAPTURE | Capture zero relevant memory after controlled forget. |
| HITL PENDING screenshot | NEEDS_CAPTURE | Run Demo 7 and capture `AWAITING_HUMAN_APPROVAL` plus approval metadata. |
| HITL APPROVE screenshot | NEEDS_CAPTURE | Use controlled internal path and capture human-attributed APPROVED result. |
| HITL REJECT screenshot | NEEDS_CAPTURE | Repeat and capture REJECTED/action stopped result. |
| 154/154 backend test evidence | NEEDS_CAPTURE | Capture the current complete backend summary only. |
| pgvector evidence | NEEDS_CAPTURE | Run validation and capture version 0.8.6, 1536 dimensions, PASS, rollback-only writes. |
| Final repository structure | NEEDS_CAPTURE | Capture a concise tree of `backend/src/ai/{graph,rag,memory,hitl}` and migrations, excluding secrets/node_modules. |
| Three-context comparison | READY | Use Section 8 table directly in Slide 10. |
| Results scorecard | READY | Use Section 7 directly in Slide 16. |

## 14. Sprint 5 presentation sections

The deterministic harness and its safe report artifacts are implemented.

| Planned section | Question to answer | Evidence required before READY |
|---|---|---|
| Harness architecture | Case → executor → observation → deterministic checks → report | READY |
| Safety evaluation | 36 reviewed cases across 14 safety/behavior domains | READY |
| Agent evaluation dataset | Versioned structured cases with evidence notes | READY |
| Quality metrics | Scenario pass/fail, pass rate, category totals, named checks | READY — explicitly not semantic accuracy/latency/cost |
| Regression evaluation | `npm run eval:harness`, `npm run agent:evaluate`, JSON/Markdown artifacts and complete suite | READY |

### Sprint 5 final closure readiness

- **Agent Harness / Safety / Evaluation:** READY — dataset v3, 36/36 offline scenarios, 14 categories, named `DOMAIN_SCOPE_ENFORCED` check.
- **Domain Scope Enforcement:** READY — real UI political question refused before model/tools/RAG/HITL; HSE follow-up remains bounded to the same thread; memory cannot broaden scope.
- **Real Angular Agent:** READY — harmless capability query and grounded/cited LOTO response passed through Angular -> API -> LangGraph -> OpenAI.
- **Live-safe evidence:** READY — 9/9, no real Actions or Incidents data, save-before-cleanup order and exact-ID cleanup verified.
- **Regression evidence:** READY — backend 154/154, frontend 7/7, harness 5/5, builds/typecheck/pgvector/integrity PASS, 42 tables and 784 rows preserved.

Defect story for the safety slides: the embedded agent was observed answering a general political question. The Guard was corrected with deterministic HSE/QHSE domain enforcement. The final flow is `User -> Guard -> Domain Scope -> Refuse` for unrelated input, or `Agent -> Tools / RAG / HITL` for authorized HSE input. This prevents the product agent from becoming a general-purpose chatbot.

### Sprint 6 final slide-status register

| Slides | Final content state | Sprint 7 evidence state |
|---|---|---|
| 1–18 | **READY (18/18)** | **NEEDS_CAPTURE** for the 17 checklist assets below |

No slide remains `PLANNED` for content. Diagram and screenshot production is deliberately deferred to Sprint 7; the PowerPoint is not part of Sprint 6.

## 15. Future update template

Copy this block for every later sprint:

```text
SPRINT:
WHAT WE BUILT:
WHY:
HOW IT WORKS:
LIVE DEMO:
TECHNICAL EVIDENCE:
TEST RESULT:
LIMITATIONS:
SLIDES AFFECTED:
ASSETS TO CAPTURE:
STATUS: READY / PARTIAL / PLANNED
```

## 16. Documentation-only validation

- Application code changed by this task: **NO**
- Database changed by this task: **NO**
- Migrations created by this task: **NO**
- Dependencies changed by this task: **NO**
- UI changed by this task: **NO**
- Documentation created by this task: **`docs/turing-sprint3-presentation-map.md` only**

## 17. Sprint 4.2C live operational-demo readiness

One explicitly authorized, minimized overdue-actions test reached `list_actions` through the HTTP/LangGraph path. The independent database audit found 8 rows, but the isolated HTTP process logged zero projected rows. Structured routing, RAG exclusion, seven-field egress minimization, personal-field exclusion, same-thread reuse, LOTO RAG regression, HITL regression, and database integrity passed.

The Sprint 4.2D local-only retest aligned the independent auditor and network-authorized HTTP/LangGraph process at 8 overdue actions. Sprint 4.2E exposed and corrected portfolio-wildcard handling. A fresh authorized real-model retest then returned all 8 minimized rows, produced a grounded initial answer, and correctly identified the most overdue action in the same thread. RAG was not used and no personal data crossed the boundary. The operational UI demo is **READY** as evidence for both `Operational Data → Tools` and `Data Minimization → Agent Safety`.
