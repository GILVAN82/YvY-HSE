# YvY HSE AI Evaluation Report

> Historical report. The current measured baseline, retained failures and reproduction instructions are in [Sprint E — EVALUATION](./EVALUATION.md). Earlier 37-case figures below are not current evidence.

## Objective

This evaluation answers: **How was the YvY HSE AI Agent measured?** It provides a versioned synthetic dataset, an offline runner, named metrics and regression evidence for tool use, operational answers, RAG, HITL, guardrails, authorization, memory and failure semantics.

The evaluation complements [Security & Ethical AI Evaluation](./SECURITY_AND_ETHICAL_AI_EVALUATION.md). This report focuses on observable functional quality; the security report focuses on data-access, privacy and human-authority boundaries.

## Evaluation Method

Two modes are deliberately separated:

1. **Controlled offline evaluation (required):** 37 versioned scenarios, deterministic synthetic fixtures, no database or provider network, and structural comparison of observed signals against expectations.
2. **LangGraph integration evidence (required in `npm test`):** representative cases execute the real graph with mock models, fake tools and fake retrieval to prove routing, grounding, refusal, HITL and controlled failure behavior.
3. **Live-safe evaluation (optional):** explicitly invoked against a running authenticated application/provider; it is excluded from default tests and its variable results are not committed as benchmark evidence.

Metrics count individual relevant checks, not repeated labels or word-for-word answer matches. A valid `NO_DATA` result does not count as a tool-selection failure. Runtime is engineering information only; mock-model latency is not presented as provider performance.

## Dataset

- Version: 3
- Scenarios: 37
- Stable IDs and versions: yes
- Data: synthetic only
- Production database required: no
- Provider network required: no

| Category | Scenarios |
|---|---:|
| RAG grounding | 5 |
| Citation | 2 |
| Operational routing | 5 |
| Data minimization | 1 |
| Safety | 2 |
| Jurisdiction | 1 |
| Thread state/isolation | 2 |
| Memory policy | 3 |
| Secret protection | 2 |
| HITL | 3 |
| Refusal | 1 |
| Failure recovery | 4 |
| Domain/authorization scope | 6 |

Scenario fields include ID, version, category, prompt, setup, expected observable behavior and evidence note. Assertions prefer tool names, citations, source IDs, statuses, approval state, authorization scope and numeric facts over exact prose.

## Metrics

| Metric | Definition |
|---|---|
| Tool Selection Accuracy | Required tool checks passed / required tool checks |
| Operational Answer Accuracy | Expected deterministic facts represented correctly |
| RAG Retrieval Accuracy | Expected source-domain matches |
| RAG Grounding Accuracy | Citation policy and source-validity checks |
| HITL Trigger Accuracy | Approval-state and no-bypass checks |
| Guardrail Accuracy | Expected refusal classifications |
| Authorization Boundary Accuracy | Server/domain-scope enforcement checks |
| Memory Behavior Accuracy | Save, retrieve, forget and isolation checks |
| Failure Handling Accuracy | Error classification and no-fabrication checks |
| Semantic Status Accuracy | Expected public response status checks |

The metric calculator returns `0/0 = 0%`, rather than dividing by zero or presenting a misleading perfect score. Framework tests prove failed checks reduce the appropriate metric.

## Results

Evaluation date: 2026-08-13. Execution mode: `CONTROLLED_OFFLINE`.

| Metric | Result | Accuracy |
|---|---:|---:|
| Tool Selection Accuracy | 11/11 | 100.0% |
| Operational Answer Accuracy | 2/2 | 100.0% |
| RAG Retrieval Accuracy | 7/7 | 100.0% |
| RAG Grounding Accuracy | 13/13 | 100.0% |
| HITL Trigger Accuracy | 9/9 | 100.0% |
| Guardrail Accuracy | 5/5 | 100.0% |
| Authorization Boundary Accuracy | 9/9 | 100.0% |
| Memory Behavior Accuracy | 9/9 | 100.0% |
| Failure Handling Accuracy | 5/5 | 100.0% |
| Semantic Status Accuracy | 5/5 | 100.0% |

Overall scenario result: **37/37 (100.0%)**.

These results establish conformance for the finite deterministic dataset. They are not a scientific estimate of correctness for arbitrary prompts or live-model output.

## Tool Selection

The dataset covers `list_incidents` behavior through agent regression evidence and directly evaluates routing to `list_actions`, `get_projects`, `get_kpi`, `search_hse_knowledge` and explicit `save_memory`. Structured operational prompts prohibit RAG selection. Tool selection and final operational correctness are measured separately.

## Operational Accuracy

The operational fact scenarios use fake fixtures containing exactly two overdue actions and two authorized open incidents. They separately check tool selection, numeric fact, read-only access and zero fabricated records.

## RAG Retrieval & Grounding

LOTO, PTW, risk-assessment and emergency prompts require approved source-domain matches. Grounded cases require citations derived from evidence. A false/missing citation scenario must fail deterministic grounding instead of finalizing an unsupported answer. No-evidence behavior forbids fabricated citations.

## HITL

Critical LOTO scenarios require `PENDING`, `LOTO_SAFETY_EXECUTION` behavior and no AI bypass. Non-critical procedural questions remain outside HITL. Wrong-thread, single-use and persistence-failure cases fail safely. Human approval is not treated as proof of physical field conditions.

## Guardrails

The suite evaluates injection, protected-instruction requests, secrets and out-of-domain prompts while retaining legitimate HSE acceptance evidence in the main test suite. This is finite regression coverage, not a universal jailbreak guarantee.

## Authorization

Domain-scope and operational cases measure server-side enforcement independently from prompt claims. Sprint 3.3 tests provide the underlying evidence for scoped SQL, foreign-project denial, ADMIN policy, approver permission and user-owned memory. Unauthorized data is filtered before model exposure.

## Memory

Evaluation covers explicit save, absence of implicit writes, same-user retrieval, forget behavior, secret/sensitive rejection and domain-scope containment. Cross-user ownership is proven by the authorization regression suite.

## Failure Handling

Synthetic model, RAG, memory and HITL failures are controlled. Provider/tool failures map to `ERROR`, zero records remain `NO_DATA`, and fabricated operational records remain zero. Safe reports exclude raw exception details and payloads.

## Semantic Status

The evaluation samples `SUCCESS`, `ERROR`, `PENDING` and `REFUSED`; the dedicated response-status regression tests cover the complete public set: `SUCCESS`, `NO_DATA`, `ERROR`, `PENDING`, `APPROVED`, `REJECTED`, `REFUSED`.

## Capstone Presentation Metrics

For a short presentation, use these six metrics:

- Tool Selection Accuracy: 11/11 (100.0%)
- RAG Grounding Accuracy: 13/13 (100.0%)
- HITL Trigger Accuracy: 9/9 (100.0%)
- Guardrail Accuracy: 5/5 (100.0%)
- Authorization Boundary Accuracy: 9/9 (100.0%)
- Failure Handling Accuracy: 5/5 (100.0%)

Always state that these are deterministic finite-dataset results, not universal model-performance claims.

## Reproduction

```powershell
cd backend
npm run eval:ai
```

Optional live-safe mode is explicit and never part of default CI:

```powershell
npm run eval:ai:live
```

Generated machine-readable and Markdown evidence is written under `artifacts/evaluation/`. The deterministic score is separate from the explicitly invoked live-safe result; timestamps and durations are engineering metadata, not accuracy inputs.

## Traceability

Examples:

- `rag-loto` → Agentic RAG → approved LOTO domain → citation/source checks.
- `operational-overdue` → tool calling → two synthetic overdue actions → tool/fact/no-fabrication checks.
- `hitl-pending` → critical LOTO → deterministic gate → `PENDING`.
- `safety-injection` → prompt guard → pre-model refusal → `REFUSED`.
- `domain-general-knowledge` → bounded domain → no tools/RAG → scope enforced.
- `failure-model` → provider failure → controlled `ERROR` → zero fabricated records.

## Limitations

- Deterministic evaluation uses synthetic fixtures and mock-model behavior.
- Live LLM tool choice and wording may vary.
- The approved RAG corpus and dataset are intentionally limited.
- The operational answer metric contains two direct numeric-fact checks; broader coverage is future work.
- No universal jailbreak guarantee is possible.
- Company-level tenancy is not implemented.
- Incident free text remains governance-sensitive.
- Mock execution duration is not real OpenAI latency.

## Conclusion

YvY HSE now has a repeatable evaluation command, versioned dataset, fail-sensitive metrics, framework regression tests and reviewer-facing evidence. The measured dataset passes fully while the report preserves the distinction between deterministic application conformance and variable live-model quality.
