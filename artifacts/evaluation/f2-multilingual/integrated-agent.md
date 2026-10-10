# YVY HSE Agent Evaluation

- Execution mode: CONTROLLED_OFFLINE
- Model mode: SIMULATED
- Commit: 46971f19cccce2aa4e3926ca979c917d40c437fa
- Source fingerprint: 35b8c0d842a5ce34c566cf6ff93b539336c5a6643c050cb2d79b7d4dd3600bf8
- Dirty working tree: true
- Scenarios: 44
- Passed: 44
- Failed: 0
- Scenario pass rate: 100.0%

## Metrics

| Metric | Result | Check pass rate |
|---|---:|---:|
| Required Tool Presence | 11/11 | 100.0% |
| Expected Operational Fact Match | 2/2 | 100.0% |
| Synthetic Source ID Match | 7/7 | 100.0% |
| Citation Presence and Source Checks | 13/13 | 100.0% |
| HITL State and Bypass Checks | 9/9 | 100.0% |
| Refusal Code Match | 5/5 | 100.0% |
| Domain Scope Enforcement Check | 9/9 | 100.0% |
| Memory Lifecycle Checks | 9/9 | 100.0% |
| Failure Code and Fabrication Checks | 5/5 | 100.0% |
| Response Status Match | 6/6 | 100.0% |
| Verification Status and Unsupported Claim Match | 16/16 | 100.0% |

## Category results

| Category | Result |
|---|---:|
| EVIDENCE_GROUNDING | 7/7 |
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

Deterministic observable-behavior regression using synthetic fixtures and mock models; this is not live-provider performance or benchmark-grade model accuracy. Synthetic retrieval does not measure real corpus recall, provider latency or linguistic quality. Required source checks require every named source; relevant source checks accept alternatives. Case IDs select independent fixtures, never expected outcomes. Reports exclude raw responses, prompts, vectors, secrets, and operational payloads.
