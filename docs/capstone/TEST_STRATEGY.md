# Test strategy and interpretation

Baseline: `a0edf23`; current executions: [H gate manifest](../../artifacts/evaluation/sprint-h/gates.json). Historical counts are not current gates.

| TEST TYPE | WHAT IT PROVES | WHAT IT DOES NOT PROVE |
|---|---|---|
| Unit | Explicit pure-function/schema/policy expectations hold for supplied inputs. | Complete domain coverage or live model quality. |
| HTTP | Real route validation, session/permission boundaries and response contracts under injected dependencies. | Browser acceptance, exhaustive penetration resistance or production database concurrency. |
| Graph simulated-model | Real graph/tool/verification transitions for controlled model parts. | Autonomous model tool choice or natural-language answer reliability. |
| Frontend | Jasmine/Karma component/service behavior and template integration in headless Chrome. | All browser/device layouts, real microphone behavior or human usability approval. |
| Hermetic | Offline agent execution blocks sockets/fetch and uses fake providers/DB; ordinary tests require no .env. | Network resilience, real SQL performance or provider uptime. |
| Agent evaluation | 44 labelled scenarios and 3 supplementary checks meet independent expectations via real components. | A 100% production/model quality claim or statistical representativeness. |
| Intent evaluation | Deterministic routing matches 134 labelled inputs. | Open-ended language understanding or all multilingual requests. |
| Retrieval evaluation | 24 queries (EN16/PT8) against four approved documents; required/relevant recall, irrelevant rate, MRR/top-1 with real retained vectors and SQL. | Universal recall, unseen-corpus accuracy or generated-answer correctness. This gate requires PostgreSQL. |
| Live-provider evaluation | An opt-in separately configured run can measure actual provider behavior for its recorded model/prompt/time. Historical live report retains 11/12. | Validation of current G/H quality without a new benchmark; equivalence to simulated results. |

The current committed suites contain 371 backend and 112 frontend tests; integrated local work adds checks (389/118). Never add these counts together as evidence of model quality. H reruns both baselines, typechecks, production builds, offline agent/intent and cached real retrieval. No paid generation, new embeddings, corpus mutation or .env change is required.

Reproduction commands are in README and the H report. Retained raw gate logs have SHA-256 checksums in the H evidence manifest. Source fingerprints distinguish committed from integrated local code. Previous F.2/G patches and vectors remain unchanged.
