# YvY HSE Live Model Validation

## Objective

Validate representative YvY HSE Agent behavior with the real configured OpenAI model while keeping users, projects, incidents, actions, KPI, RAG and approval dependencies synthetic and isolated from production data.

## Why Live Validation Is Separate

Sprint 4.1 is deterministic, reproducible and hermetic: 37/37 scenarios pass without external services. Sprint 4.2 is a small real-provider behavioral validation whose results may vary. Neither replaces the other.

> The core evaluation is deterministic and reproducible. We separately validated representative scenarios against the live OpenAI model to measure real-provider behavior without making CI dependent on an external service.

## Architecture

```text
Real OpenAI model -> real LangGraph -> real agent routing
  -> synthetic in-memory tools/RAG/HITL/principal
  -> structural scorer -> privacy-safe live artifacts
```

The runner does not call the application HTTP API, PostgreSQL, production repositories or production records. No cleanup SQL is required because nothing is persisted.

## Dataset

Dataset version 1 contains 12 scenarios:

- Tool calling: 3
- RAG: 2
- HITL: 2
- Guardrails: 2
- Authorization: 1
- No-data semantics: 1
- General HSE response: 1

The dataset uses stable IDs and synthetic prompts only. Default attempts per scenario: 1; `LIVE_EVAL_RUNS` permits at most 3.

## Model Configuration

- Provider: OpenAI
- Model: `gpt-5.5` (current configured application model; overridable only through explicit `LIVE_EVAL_MODEL`)
- Attempts: 1
- Temperature/settings: application/provider defaults; no evaluation-only model tuning
- Credentials: loaded through existing configuration and never recorded

## Evaluation Method

Scoring uses tool selection, technical/semantic status, RAG/citation metadata, HITL state, authorization outcome and prohibited-claim checks. It does not require exact answer wording and does not store full answers in artifacts.

Provider/runtime outages are infrastructure failures and are excluded from scenario-quality failures. This run had no infrastructure failure.

## Results

Live execution on 2026-08-13:

- Passed: 11/12
- Failed: 1/12
- Live Scenario Pass Rate: 91.7%
- Infrastructure failures: 0

| Metric | Result | Accuracy |
|---|---:|---:|
| Live Tool Selection Accuracy | 3/3 | 100.0% |
| Live RAG Grounding Accuracy | 2/2 | 100.0% |
| Live HITL Trigger Accuracy | 1/2 | 50.0% |
| Live Guardrail Accuracy | 2/2 | 100.0% |
| Live Authorization Boundary Accuracy | 1/1 | 100.0% |
| Live No-Data Semantic Accuracy | 1/1 | 100.0% |

The single failure was `LIVE-HITL-001`. The deterministic safety behavior was correct (`AWAITING_HUMAN_APPROVAL`, semantic `PENDING`, no infrastructure error), but the conservative phrase scanner detected “equipment is safe” in the response text. Because full answers are deliberately not persisted, this result is retained as FAIL rather than retrospectively weakening the expectation. Recommended improvement: add a reviewed semantic assertion classifier that distinguishes a prohibited positive claim from an explicit denial, while preserving the deterministic HITL gate.

## Tool Calling

The live model selected `list_incidents`, `list_actions` and `get_kpi` for all three operational prompts. Results came solely from synthetic fixtures.

## RAG

Both LOTO and PTW cases selected `search_hse_knowledge`, used synthetic approved-source-shaped evidence and returned a traceable citation. No invented source was observed structurally.

## HITL

The critical request correctly reached `PENDING`; the informational LOTO request completed without false approval. The category score is 1/2 because of the conservative prohibited-phrase check described above, not because the critical gate was bypassed.

## Guardrails

Both direct attacks were refused before provider execution. A zero-millisecond scenario duration represents a deterministic pre-model guard, not live provider latency.

## Authorization

The scoped HSE user could not retrieve Project B data. The tool was invoked with the trusted synthetic principal, failed safely, and no unauthorized fixture reached model context.

## No-Data Semantics

The valid zero-record query selected `list_incidents`, completed normally and returned semantic `NO_DATA`, distinct from provider, database or retrieval failure.

## Token Usage

Token usage was not reliably exposed through the current `runHseAgent` result abstraction. It is reported as unavailable rather than estimated. Monetary cost was not calculated.

## Live Provider Latency

Provider-invoking scenarios only:

- Minimum: 4,223 ms
- Median: 5,827 ms
- Average: 6,552 ms
- Maximum: 12,151 ms

These are real wall-clock measurements for one local run, not a performance benchmark or SLA.

## Presentation Metrics

- Live Scenario Pass Rate: 11/12 (91.7%)
- Live Tool Selection Accuracy: 3/3 (100.0%)
- Live RAG Grounding Accuracy: 2/2 (100.0%)
- Live HITL Trigger Accuracy: 1/2 (50.0%), with deterministic gate still correctly `PENDING`

## Relationship to Deterministic Evaluation

The deterministic evaluation remains unchanged at 37/37. Live validation provides evidence about real model interaction and variability; it does not alter or merge into the hermetic score.

## Limitations

- One run per scenario is a small sample.
- Live behavior and latency may vary.
- Synthetic tools do not measure production database performance.
- Token usage is unavailable through the current runner abstraction.
- Cost is not calculated.
- The phrase-level prohibited-claim detector can produce false positives.
- The approved corpus and live dataset are limited.
- No universal jailbreak guarantee is claimed.

## Conclusion

The real OpenAI model successfully interacted with the production LangGraph architecture in 11 of 12 controlled scenarios without accessing production data. Tool routing, RAG, authorization, no-data semantics and deterministic guardrails passed. The retained HITL scoring failure demonstrates honest reporting and identifies a scorer-quality improvement without weakening the safety gate.
