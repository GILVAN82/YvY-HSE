# SPRINT H - FINAL PROJECT COMPLIANCE

Documentation-only consolidation, 9 September 2026. No runtime, corpus, environment, provider/model or Command Center behavior changed. No Demo Mode was implemented.

## Git and baseline

Branch: `capstone/yvy-hse`. Runtime HEAD at audit: `a0edf2398be4ac4cc91947f8b614460e548b35ad`. H is the documentation commit containing this report (`git log -1 --format=%H -- docs/capstone/SPRINT_H_FINAL_COMPLIANCE.md` resolves it without a self-referential hash).

| Baseline | Commit | Responsibility |
|---|---|---|
| D | `1d93165` | Authorization and attention isolation |
| E/E.1 | `79f3f41` | Evaluation and reproducibility |
| F | `14e3c47` | RAG production hardening |
| F.1 | `46971f1` | Approved corpus validation |
| F.2 | `8b0e987` | PT/EN retrieval consistency |
| G | `a0edf23` | Prompt architecture and observability |
| H | This documentation commit | Current compliance and evidence consolidation |

The starting working tree contained 55 expanded modified/untracked file entries. **54 are byte-identical** to their pre-H backup. The existing untracked code map was explicitly requested for update; its original is backed up and its replacement is included in H. No unrelated local work is staged. [Preservation manifest](../../artifacts/evaluation/sprint-h/preservation.json) records every entry and hash.

**COMMITTED:** scoped read-only agent tools, approved retrieval, memory, digital HITL, authentication/project controls, verification, voice, attention and diagnostics. Generic app-data tools are committed, but broader automatic intent routing is local.

**LOCAL / UNCOMMITTED:** record-draft write/review work, expanded automatic module routing, incident-count fallback and chat layout/history refinements. Integrated counts include these changes; committed counts do not. Do not demonstrate local features as released baseline functionality.

**FUTURE:** YvY HSE Demo Mode and separately scoped evaluation/deployment hardening.

## Deliverables

| Area | Result / evidence |
|---|---|
| README | Purpose and visible pending Showcase marker; current workflow, capabilities, limitations and exactly one consolidated ethics section. |
| Architecture | [Current architecture](../architecture.md): controlled state graph + deterministic router + bounded tool loop, with ReAct/Plan-and-Execute comparison. |
| RAG | Four documents; original semantic query and controlled PT lexical expansion; gates/RRF, citations and abstention. Corpus fingerprint retained. |
| Evaluation | [Test strategy](TEST_STRATEGY.md) separates nine test types, simulated/offline, real cached retrieval and historical live results. |
| Security/Ethics | Authentication/project isolation and semantic verification are current; [residual risks](../limitations.md) classify real limitations and future hardening. |
| Code Map | [Current map](../turing-code-map/YVY_HSE_COMPLETE_CODE_MAP.md) has committed/local symbol lines and review sequence. |
| Defence Notes | [WHAT/WHY/HOW and alternatives](DEFENCE_NOTES.md) for all requested components, plus runner/guard. |
| Project Matrix | [Canonical Case 2 mapping](TURING_REQUIREMENTS_MATRIX.md), complementary RAG, evidence/tests/commits/remaining. |
| Reviewer Matrix | [Seven reviewers](REVIEW_COMPLIANCE_MATRIX.md), individual topics plus all 58 recorded reviewer-labelled source rows. |
| Presentation Matrix | [Six points](PRESENTATION_EVIDENCE_MATRIX.md), screen/evidence/timing; maximum 600 seconds. |
| Q&A | [Twenty concise defence answers](TURING_QA.md). |
| Demo plan | [Six planned steps and eight Inspector fields](TURING_DEMO_CONTENT_PLAN.md); documentation only. |
| Showcase | MISSING / USER ACTION REQUIRED. No URL invented. |

## Final test gate

All checks ran again for H. Runtime source is unchanged; isolated `a0edf23` validates the committed baseline, while the integrated tree verifies compatibility with existing local work.

| Gate | COMMITTED | INTEGRATED LOCAL | What it establishes |
|---|---:|---:|---|
| Backend `npm.cmd test` | 371/371 | 389/389 | Supplied unit/HTTP/graph contracts |
| Backend typecheck and build | PASS | PASS | Type and compilation checks |
| Frontend `npm.cmd run test:ci` | 112/112 | 118/118 | Headless Chrome service/component checks |
| Frontend app/spec typechecks | PASS | PASS | Both TypeScript targets |
| Frontend production build | PASS | PASS | Compiles; existing non-blocking budget warnings |
| Agent evaluation | 44/44 | 44/44 | Labelled simulated-model scenarios |
| Supplementary evaluation | 3/3 | 3/3 | Empty results and scoped approval |
| Intent evaluation | 134/134 | 134/134 | Deterministic labels |
| Hermetic agent runner | PASS | PASS | Socket/fetch blocked; injected DB/model |
| Real cached retrieval | 24 queries | 24 queries | Real SQL and retained embeddings; not database-free |

[Gate commands/exits](../../artifacts/evaluation/sprint-h/gates.json), [summary, source identity and log hashes](../../artifacts/evaluation/sprint-h/summary.json), [committed agent artifact](../../artifacts/evaluation/sprint-h/committed-agent.json), [integrated agent artifact](../../artifacts/evaluation/sprint-h/integrated-agent.json).

The isolated retrieval artifact reports `workingTreeDirty=true` after evaluation wrote its artifact/latest pointer. Tracked backend/frontend source was verified unchanged against `a0edf23`. Integrated source fingerprints intentionally differ due to preserved local features. H did not replace the existing repository-wide `offline-latest.json` pointer.

### Retrieval result

[Committed replay](../../artifacts/evaluation/sprint-h/committed-retrieval.json) and [integrated replay](../../artifacts/evaluation/sprint-h/integrated-retrieval.json) exactly match G metrics, language breakdowns and retrieval configuration.

| Mode | Required/relevant recall | Irrelevant retrieval rate | MRR / top-1 |
|---|---:|---:|---:|
| Hybrid RRF | 1.0 / 1.0 | 0 | 1.0 / 1.0 |
| Semantic-only | 0.666667 / 0.666667 | 0 | 0.636364 / 0.636364 |

EN16 (14 positive, 2 negative), PT8 (8 positive). These are the evaluator's recorded aggregate definitions; recall divides total matched source labels by total required/relevant source labels (micro-aggregation); negative queries have no such labels and are checked separately for false retrieval, while ranking metrics apply to positive queries. Do not relabel this as universal model accuracy. No generated-answer quality is measured by scripted retrieval runtime checks.

Corpus fingerprint: `cd19ac92e204c7f9e7ee59bec8af925ad8cbd898b271a765d782a32a3dc4f6a1`. Four approved documents; `text-embedding-3-small`, 1536 dimensions; semantic threshold 0.45; ANN deferred. No corpus ingestion, new embeddings or provider/model change occurred.

### Reproduction

Use a checkout at `a0edf23` (or H, whose runtime is unchanged), install locked dependencies, then run the README backend/frontend commands. The isolated checkout has no `.env`; ordinary tests and offline evaluation do not need it. For retrieval, use the existing approved PostgreSQL corpus and validated F.2 cached vectors:

```powershell
cd backend
node --require ts-node/register/transpile-only src/ai/rag/multilingual.cli.ts --run-dir ../artifacts/evaluation/f2-multilingual --profile after-h-new-replay
```

Load the database configuration through the normal local environment/bootstrap; never copy credentials into artifacts. Use a unique profile name: artifacts are immutable. The CLI checks source/embedding/cache identity, uses real SQL and blocks HTTP when replaying retained vectors. Previous E/F/G artifacts and patches remain untouched. Raw H logs are retained locally at the path recorded in `summary.json`, with SHA-256 hashes; concise machine-readable evidence is committed.

## Documentation consistency audit

The README's obsolete 209-test/no-auth/no-RBAC statements were replaced. Old branch/code-map references were replaced by runtime `a0edf23` and generated symbol locations. Pre-H documents now have explicit versioned/historical notices, including older memory, state, HITL, attachment, voice, RAG, evaluation and presentation descriptions. Their original bodies/results were retained rather than rewritten as current evidence.

[Search audit](../../artifacts/evaluation/sprint-h/doc-consistency-audit.json) records patterns for old counts, old branch/hash, no-auth/RBAC, structural-only verification, Chroma and Streamlit. Historical reports may still contain those original words, but are explicitly superseded. Current architecture uses Angular, Express, LangGraph, AI SDK and PostgreSQL/pgvector. No Chroma or Streamlit runtime is claimed.

Source scope: the user's H request supplies Case 2 and the official-project criteria to map. The full original institutional rubric and external reviewer transcripts are not in the repository. The matrices therefore do not assert exact institutional wording or reviewer sign-off. Supplying originals would enable a final wording/coverage cross-check; it is not used as a reason to withhold the authorized implementation.

## Project official dashboard

Legend: validated within stated checks / implemented / remaining / missing.

| Perspective | Status |
|---|---|
| PROJECT OFFICIAL | 🟡 |

The overall status remains pending because outcome-quality evidence, presentation rehearsal and Showcase submission are not all complete. Per-criterion statuses are in the canonical matrix.

## Review dashboard

| Reviewer | Status |
|---|---|
| Jochen Zuegge | 🟡 |
| Stefano Ciaci | ✅ |
| Vytautas Bunevičius | 🟡 |
| Erikas Švažas | ✅ |
| Andrius Grevys | 🟡 |
| Justinas Gibas | 🟡 |
| Fatima Cristina Vieira da Costa | 🟡 |

A reviewer-wide implemented status means the mapped engineering/documentation work exists; it is not reviewer approval. None is globally marked validated while meaningful reviewer work remains.

## All remaining items

| ID | Remaining item | Classification / owner |
|---|---|---|
| H-01 | Submit a real Showcase and supply its URL; replace the visible README pending marker afterward. | MISSING / USER ACTION REQUIRED - Gilvan |
| H-02 | Rehearse six-point story and planned steps, verify timing, browser/microphone/provider/database/project access and safe HITL context. | PRESENTATION REMAINING - Gilvan with technical preflight |
| H-03 | Gilvan explains WHY, alternatives, failure modes and code ownership; human review of documentation/presentation wording. | PRESENTATION REMAINING - Gilvan |
| H-04 | Current live-provider generated-answer benchmark and availability check for configured model; historical 11/12 is not current quality proof. | CURRENT EVIDENCE LIMITATION - separate scoped evaluation |
| H-05 | Larger independent retrieval/generation evaluation, unfamiliar terminology, jurisdictions/languages, broader relevance/latency calibration. | FUTURE HARDENING - no corpus expansion in H |
| H-06 | Equipment-level LOTO linkage and delegated/team approval design where required. | FUTURE HARDENING; current exact-project/owner checks fail closed |
| H-07 | Transactional parent/project resource moves and reassignment races. | FUTURE HARDENING; current checks do not prove full transaction isolation |
| H-08 | Production stress/outage tests, latency study, external security/privacy assessment. | FUTURE HARDENING; injected failures are not production experiments |
| H-09 | Free-text personal-data handling, consent/provider/voice policy, retention/deletion/backups and global reference classification business review. | CURRENT LIMITATION / deployment governance |
| H-10 | Normalize ambiguous contractor/project relations before widening data access. | FUTURE HARDENING; ambiguous records remain unavailable |
| H-11 | Central secrets, backup/recovery validation and durable audit governance; no cost or immutable Inspector audit claim. | DEPLOYMENT HARDENING |
| H-12 | Company-level SaaS tenancy, legal/production certification, physical execution/verification. | OUT OF PROJECT SCOPE; no capability claim |
| H-13 | Full institutional rubric/original reviewer feedback wording cross-check if supplied. | SOURCE COVERAGE LIMITATION; user-supplied Case 2 mapping complete |
| H-14 | Local record draft, expanded routing/count and shared-chat work needs its own review/commit before it can be shown as committed. | LOCAL / UNCOMMITTED; preserved, not included in H |
| H-15 | YvY HSE Demo Mode implementation, only in a separately requested next sprint. | FUTURE; H contains the content plan only |

Legacy path non-parity, finite injection/semantic checks, limited corpus and browser-dependent STT remain declared product boundaries; they are not silently closed by this documentation sprint. No remaining recommendation from the reviewer source inventory is removed by the consolidated dashboard.

## Ready for YvY HSE Demo Mode?

**YES - ready to begin a separately scoped Demo Mode implementation from the validated committed runtime and this content plan.** This is not a claim that the demonstration is rehearsed, that Showcase submission is complete, or that official assessment is passed. Public presentation/submission readiness remains REMAINING until H-01 to H-03 and appropriate environment preflight are handled. Live-quality and hardening limitations must remain visible.

H stops here. Commit message: `docs(capstone): consolidate final compliance evidence`.
