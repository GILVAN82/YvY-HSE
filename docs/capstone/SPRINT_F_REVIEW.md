# Sprint F review and defence

Sprint F.1 update: the four approved sources have now been reingested and validated against PostgreSQL. See [approved corpus validation](APPROVED_CORPUS_VALIDATION.md) for real-corpus metrics, idempotence, external calls and remaining limits. The Sprint F observations below are historical.

## Review dashboard

| Review perspective | Evidence added | Remaining limit |
|---|---|---|
| Turing | Hybrid RAG, hermetic evaluation, typed query preparation, grounding and explicit abstention | Real-corpus/live-provider quality not validated |
| Jochen | Traceable sources and focused retrieval pipeline | Demo Mode intentionally deferred |
| Stefano | Schema-based deterministic query plan; no user-to-system interpolation | No LLM rewrite claimed or needed |
| Vytautas | RRF, branch thresholds, bounded chunks, stable IDs, corpus/config fingerprints, required/relevant metrics, narrow errors | Larger relevance calibration and deployment reingestion |
| Erikas | Central validated config, explicit models and specific failures | Future planner must retain structured-output boundary |
| Andrius | Alternatives, trade-offs and failure-mode tests | Production latency/recall study when corpus grows |
| Justinas | Row/vector validation near provider/repository; outage degradation | No paid-provider outage exercise |
| Fatima | Typed plans, evidence, diagnostics and result states; configuration validation | Legacy successful envelope retained for compatibility |

These are evidence mappings, not claims of reviewer approval.

## Defence note

**WHAT:** Harden the existing public-reference RAG with bounded canonical chunks, stable
identity, complete corpus/config manifests, PostgreSQL lexical retrieval, RRF and independent
retrieval evaluation. Preserve operational tools, authorization, HITL and verification.

**WHY:** Vector-only search can confuse related concepts and lose exact identifiers. Reproducible
processing and source completeness are essential when an answer may influence HSE decisions.

**HOW:** Validate a deterministic query plan; retrieve semantic and lexical candidates; apply
branch relevance and E.1 jurisdiction constraints; fuse ranks; enforce source completeness;
retain provenance; verify generated claims. Exercise the actual orchestration with injected
hermetic dependencies and a separately labeled read-only PostgreSQL integration smoke.

**ALTERNATIVES:** Vector-only is simpler but lacks a second exact-term signal. Raw score addition
mixes incomparable units; RRF requires only ranks. An LLM rewrite adds cost, latency and prompt
failure surface; preserving the original query in a schema is sufficient for this sprint.
ANN is unnecessary for the observed four chunks and is deferred pending measurements.

**TRADE-OFFS:** Conservative lexical coverage/jurisdiction filtering can reject useful sources.
Hard windows can split words; offsets preserve content and the declared estimate remains bounded.
RRF improves ordering without guaranteeing relevance or eliminating vector false positives.
Compatibility keeps numeric DB keys and old rows readable until intentional reingestion.

**FAILURE MODES:** Provider outage → explicit permitted fallback; insufficient evidence → abstain;
missing required source → partial evidence withheld; wrong/unspecified legal scope → no legal
support; malformed rows/configuration/programming faults → explicit error, not empty evidence.
Abstaining is preferable to guessing because the tool cannot establish absent source authority.

**HSE VALUE:** Better retrieval of procedures, acronyms and identifiers, with visible limits and
traceability. It does not replace competent human review or extend authorization scope.

**TURING VALUE:** Demonstrates measurable retrieval engineering, reproducibility, justified
architectural choices and candid evaluation limits rather than checklist complexity.

## Validation

Final gates: backend integrated **368/368**, isolated Sprint F **350/350** (18 preexisting local tests are outside the commit). Frontend **117/117**. Backend typecheck/build and frontend app/spec typechecks/build passed. Frontend retains existing size warnings (745.82 kB initial, two component-style warnings); budgets were not increased. Default tests/evaluation need no keys or external service. No paid calls or environment-file changes.

Agent evaluation **44/44**, supplementary **3/3**, intent **134/134**. Fresh replay from the retained source patch matched 11 source/config fingerprints, all retrieval observations/metrics and corpus fingerprint. Patch SHA-256 verified.

Artifacts:
- [Agent baseline and reproduction patch metadata](../../artifacts/evaluation/2026-09-09T16-29-54-835Z-79f3f4145664-offline.json)
- [Retrieval comparison](../../artifacts/evaluation/2026-09-09T16-29-55-807Z-79f3f4145664-retrieval.json)
- [Replay verification](../../artifacts/evaluation/sprint-f-reproduction.json)
- [Registered corpus manifest](../../artifacts/evaluation/sprint-f-registered-corpus.json)
- [Legacy stored corpus audit](../../artifacts/evaluation/sprint-f-stored-corpus-audit.json)

Deployment limitation discovered during read-only audit: all four stored document hashes match their stored text but differ from the registered Markdown sources. Their embedding/chunking configuration identities are unknown legacy values. Reingestion is needed to synchronize source content and activate stable IDs; it was not performed because it would generate real embeddings. This is not a claim that the database corpus was updated by the code commit.
