# YVY HSE Agent Evaluation

- Execution mode: CONTROLLED_OFFLINE
- Scenarios: 37
- Passed: 37
- Failed: 0
- Scenario pass rate: 100.0%

## Metrics

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
| Semantic Status Accuracy | 6/6 | 100.0% |

## Category results

| Category | Result |
|---|---:|
| RAG_GROUNDING | 5/5 |
| CITATION | 2/2 |
| OPERATIONAL_ROUTING | 5/5 |
| DATA_MINIMIZATION | 1/1 |
| SAFETY | 2/2 |
| JURISDICTION | 1/1 |
| THREAD_STATE | 1/1 |
| THREAD_ISOLATION | 1/1 |
| MEMORY_POLICY | 3/3 |
| SECRET_PROTECTION | 2/2 |
| HITL | 3/3 |
| REFUSAL | 1/1 |
| FAILURE_RECOVERY | 4/4 |
| DOMAIN_SCOPE | 6/6 |

## Failures

- None

## Interpretation

Deterministic observable-behavior regression using synthetic fixtures and mock models; this is not live-provider performance or benchmark-grade model accuracy. Reports exclude raw responses, prompts, vectors, secrets, and operational payloads.

## Live-safe validation (reported separately)

- Scenarios: 9
- Passed: 9
- Failed: 0
- Cleanup: PASS
- Operational Actions data used: NO
- Incident data used: NO
