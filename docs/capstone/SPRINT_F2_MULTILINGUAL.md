# Sprint F.2 — Multilingual retrieval and baseline consistency

Base commit: `46971f19cccce2aa4e3926ca979c917d40c437fa` (F.1), following F `14e3c47`.
Scope: controlled PT/EN retrieval and routing consistency only. Approved documents, `.env`,
generation prompts, authorization and HITL are unchanged. Sprint G and Demo Mode are deferred.

## Failure analysis before implementation

[Pre-change audit](../../artifacts/evaluation/f2-multilingual/before-analysis.json) retains
each original/normalized query, plan, semantic and lexical candidates, scores, raw RRF
ranking, threshold decision and final outcome. All four approved documents are English,
version `YvY-curated-summary-v1.0`; all four Portuguese queries retained their original text.

| Original PT case | Required source | Correct semantic top-1 score | Original lexical coverage of required source | Outcome at 0.45 |
|---|---|---:|---:|---|
| loto-pt | OSHA LOTO | 0.366193 | 0.111111 | No accepted evidence |
| ptw-pt | HSE HSG250 | 0.348412 | No lexical hit | No accepted evidence |
| risk-pt | HSE risk assessment | 0.443323 | 0.076923 | No accepted evidence |
| emergency-pt | HSE emergency procedures | 0.391532 | No lexical hit | No accepted evidence |

Causes: **LANGUAGE MISMATCH, DOCUMENT LANGUAGE, LEXICAL TOKENIZATION, QUERY PLAN,
THRESHOLD**, with **EMBEDDING SEMANTICS** providing correct relative ranking but insufficient
absolute similarity. Normalization and metadata/jurisdiction were not the cause in these
four cases. A multilingual embedding is not a guarantee of cross-language score calibration.

The old deterministic plan sent Portuguese to both vector and lexical branches. PostgreSQL
`simple` lexical search cannot infer that “bloqueio e etiquetagem” means “lockout/tagout”.
The original cosine vectors are retained; no embedding improvement is claimed.

## Controlled cross-language strategy

`technicalGlossary.ts` contains a finite, typed HSE PT→EN vocabulary anchored to the approved
topics. It projects known technical phrases and limited supporting terms into lexical
keywords, including LOTO, PTW, risk assessment and emergency procedures. It is not a general
sentence translator. All unknown content causes fallback to the original query; unsupported
ES/FR/DE have no new translation support. Original identifiers/acronyms are retained.

The explicit query-plan schema records source/retrieval language, canonical representation,
glossary version, applied expansions and unknown terms. Original query and semantic query
remain unchanged, including negation and jurisdiction. The projection is retrieval data,
never a system instruction or HSE evidence. An invalid plan falls back to the original.
The language tag is a deterministic vocabulary hint, not a general language detector.

The lexical branch measures coverage against its actual keyword query (minimum 0.6).
The semantic threshold remains **0.45**, top K **3**, candidate limits **12**, RRF k **60**.
Specifically named topics now require a compatible primary module among the four approved
modules; incidental mentions in another module are insufficient. Multi-topic requests allow
both named modules. Unrecognized modules retain previous behavior, so expanding the corpus
requires explicit policy review. This bounded source policy is not general semantic entailment.

New configuration: `hybrid-pt-v2`, reformulation `controlled-hse-pt-en-v1`, primary-source
policy `approved-module-primary-v1`, with glossary/config/source fingerprints. No threshold
was lowered and no source text was edited to fit the questions.

## Routing baseline and preservation

Before changes, 55 local file entries were backed up along with `git diff --binary`.
`backend/src/ai/intent/intentRouter.ts` was the relevant overlap. Its local PREPARE_RECORD
branch matched a write word and an entity anywhere in the question. In:

> Explain the risk assessment cycle: identify hazards, assess risks, control, record and review.

“record” satisfied both regexes. The integrated router selected `get_record_form`,
`prepare_record_draft`, `get_projects`; retrieval then returned `NOT_APPROPRIATE` because of
the operational tool. No plan or final candidates were used. Committed F.1 selected
`SEARCH_HSE_KNOWLEDGE`, producing the correct risk source. Thus original-16 hybrid recall
was 68.75% integrated versus 75% committed.

Classification: local record creation is a **PARTIAL FEATURE / DESIRED NEW BEHAVIOR**;
its incidental match on a methodological explanation is a **REGRESSION**. Broad local
app-data routing (such as PPE) also needs methodological precedence. Other local UI, draft,
counting and graph changes are **UNRELATED WORK**, retained outside this commit.

The shared `isHseKnowledgeQuestion` policy follows out-of-scope rejection and precedes local
record/module routes. Explicit writes and live/count/status requests retain their operational
handling. Root workspace preserves the local record feature; the isolated commit includes
only the new policy/import/precedence in the committed router, not that unfinished feature.

## Authoritative runtime path

Command Center → `/api/ai/chat` production dependencies → agent intent/tool selection →
`search_hse_knowledge` → `RagRetrievalService` → shared `prepareQuery` / repository / gates / RRF.
The multilingual evaluation constructs that same service with real PostgreSQL and retained
real query vectors; it does not implement a second ranking algorithm. Raw ungated candidates
are diagnostic only; scored final evidence is the actual production service result.

Four Portuguese pair queries also run through the real graph/tool with a scripted model;
retrieval status and configuration agree with direct service execution. These checks do not
measure autonomous model tool selection or answer quality. The original 44-case hermetic
agent suite remains a separate evaluation with synthetic dependencies.

## Retrieval evaluation

Dataset: **24 queries**, preserving the original 16 without changing labels, plus four manually
labeled equivalent EN/PT pairs. **EN n=16** (14 positive, 2 negative); **PT n=8** (8 positive);
other languages n=0. There are 24 required/relevant source occurrences because two English
questions require two sources. Recall is micro-averaged over source occurrences; MRR/top-1
use the 22 positive questions; irrelevant rate divides irrelevant hits by all retrieved hits.

All comparisons use the same 24 queries, vectors, four documents and PostgreSQL. Only eight
new original queries were embedded in one successful `/v1/embeddings` batch; 16 prior query
vectors and all document vectors were reused. The initial sandboxed network attempt failed;
it produced no cache. Cached comparisons block HTTP and perform no provider calls or DB writes.

| Profile / mode | Required recall | Relevant recall@3 | Irrelevant rate | MRR | Top-1 |
|---|---:|---:|---:|---:|---:|
| Before committed / semantic | 66.67% | 66.67% | 11.11% | 0.6364 | 63.64% |
| Before committed / hybrid | 70.83% | 70.83% | 10.53% | 0.6818 | 68.18% |
| Before integrated / semantic | 62.50% | 62.50% | 11.76% | 0.5909 | 59.09% |
| Before integrated / hybrid | 66.67% | 66.67% | 11.11% | 0.6364 | 63.64% |
| After committed + integrated + replay / semantic | 66.67% | 66.67% | 0% | 0.6364 | 63.64% |
| After committed + integrated + replay / hybrid | 100% | 100% | 0% | 1.0000 | 100% |

| Language / mode | Before committed required / relevant / top-1 | Before integrated required / relevant / top-1 | After required / relevant / top-1 |
|---|---|---|---|
| EN n=16 / semantic | 93.75% / 93.75% / 92.86% | 87.50% / 87.50% / 85.71% | 93.75% / 93.75% / 92.86% |
| PT n=8 / semantic | 12.50% / 12.50% / 12.50% | 12.50% / 12.50% / 12.50% | 12.50% / 12.50% / 12.50% |
| EN n=16 / hybrid | 100% / 100% / 100% | 93.75% / 93.75% / 92.86% | 100% / 100% / 100% |
| PT n=8 / hybrid | 12.50% / 12.50% / 12.50% | 12.50% / 12.50% / 12.50% | 100% / 100% / 100% |

Original-16 hybrid required/relevant recall: committed 75%, integrated 68.75%, after both
100%; irrelevant rate remains 0% on that original subset. The expanded set exposed two
incidental PTW hits for risk-assessment pair questions in the before baseline. Primary-module
filtering removes them. All four new equivalent pairs retrieve the same required source after F.2.

The 100% result is a small, targeted regression result, **not a held-out benchmark or universal
multilingual quality claim**. Glossary design was informed by observed PT failures. Eight PT
questions and two negatives cannot estimate production error rates. Semantic-only PT recall
remains 12.5%; the measured gain comes from the controlled lexical bridge, not better vectors.
No generated-answer accuracy, external legal validation or production latency claim is made.

### Reproduction and fingerprints

[Comparison artifacts](../../artifacts/evaluation/f2-multilingual/comparison.json) record all
fingerprints and equality assertions. Individual `before-committed`, `before-integrated`,
`after-committed`, `after-integrated` and `after-replay` reports retain every case and candidate.
“after-committed” means the isolated commit candidate evaluated over F.1, before creating
the final commit; the dirty-tree flag and source fingerprint deliberately describe that fact.

- Corpus: `cd19ac92e204c7f9e7ee59bec8af925ad8cbd898b271a765d782a32a3dc4f6a1`
- Dataset: `f23a08b76106f845364fb64170ba467b3a0adca6649b6640f4101e7d8acd344a`
- Query vectors: `9877239849e3d3ee72eb4631d8300f897501469ab8a096bc1904990dffd3e4eb`
- Embedding config: `8409d0f783f63f92d3d02fe8da09b4350ed2ce50a0f13532e7892a217cade5e2`
- After hybrid config: `5271169dc89a6166585808371bd6bb1362d6903fe49cb039040bc7f8cf82e320`

Use the retained agent artifact's SHA-256-checked reproduction patch on F.1. Install locked
dependencies, provide the existing database environment securely, and run from `backend`:

Reproduction patches are pinned to LF in `.gitattributes` so Windows checkout preserves their SHA-256.

```powershell
node --require ts-node/register/transpile-only src/ai/rag/multilingual.cli.ts --run-dir ../artifacts/evaluation/f2-multilingual --profile after-new-replay
npm.cmd run eval:offline
```

The first command validates approved content/configuration and stored vectors before measuring.
It needs the F.1-approved PostgreSQL corpus (pgvector 0.8.6, four documents/four chunks, 1536
dimensions); the committed public cache replaces query API calls, not the real database.
Before baselines use the same neutral measurement driver/dataset over F.1 code, with the
pre-change backend backup restored only for the integrated baseline. Neither baseline receives
F.2 planning/routing/service changes. Integrated and isolated source fingerprints differ due
to preserved local features; their final plans, statuses, sources and metrics agree after F.2.

## Safety and regression

Wrong jurisdiction is still checked against the original question and source metadata/content;
OSHA is not accepted as Portuguese law. Unknown exact equipment codes cannot be translated
away. No-evidence queries abstain. Source content returned by the service is byte-checked
against approved indexed content; keyword expansions cannot enter evidence. Existing partial
required-source withholding, operational separation and provider-outage tests remain green.

Integrated: backend **376/376**, frontend **117/117**. Isolated candidate: backend **358/358**,
frontend **111/111**. Agent **44/44**, supplemental **3/3**, intent **134/134**, including fresh
patch replay. Backend typecheck/build and frontend app/spec typechecks/build pass in both
environments. Hermetic agent execution blocks sockets/fetch. Frontend budget warnings remain
non-fatal; no frontend budget or UI files are changed by F.2. Counts differ because local
features and their tests are excluded from the isolated candidate. See retained gate evidence.

## Turing and reviewer dashboard

| Perspective | F.2 evidence | Remaining limitation |
|---|---|---|
| Turing — RAG / evaluation / prompt engineering / interaction | Shared multilingual retrieval, paired real-corpus metrics, input/data separation, methodological routing | No prompt redesign or UI change; no live generated-answer quality study |
| Jochen — grounding | Every accepted chunk traces to unchanged approved content | Four public summaries, not exhaustive HSE knowledge |
| Stefano — structured queries | Explicit plan, language/expansion fields, original fallback | Controlled PT vocabulary only |
| Vytautas — quality / reproducibility / relevant and required sources | Both source recalls, irrelevant rate, MRR/top-1, same retained vectors, clean patch replay | Small targeted set; independent larger validation remains necessary |
| Erikas — config / contracts | Typed glossary and schema, versioned source policy/config fingerprint | Additional languages/modules need controlled extensions |
| Andrius — failures / trade-offs | Four PT score traces, record-route diagnosis, unchanged threshold, narrow lexical bridge | Unknown terms intentionally forgo expansion |
| Justinas — robustness | Operational precedence, topic/exact/jurisdiction gates, abstention, hermetic regression | Primary-topic constraints are bounded, not an entailment model |
| Fatima — explicit models / validation | Typed plans/results, asserted cache/corpus identity, per-language sample counts | Scripted runtime checks do not validate autonomous generation |

These are evidence mappings, not claims of reviewer approval.

## Defence note

**Why did Portuguese queries fail?** English-only documents and unchanged Portuguese lexical
queries produced little lexical overlap. Correct semantic top-1 scores were below 0.45.

**Why not simply lower the threshold?** It would admit weaker vector matches without solving
the missing lexical language bridge. We kept 0.45 and measured irrelevant retrieval alongside recall.

**How did you support cross-language retrieval?** A finite deterministic technical glossary
creates English lexical keywords; original Portuguese semantic vectors and user text remain intact.

**How do you ensure translated terms are not evidence?** They exist only in the query plan.
Accepted evidence comes from indexed approved chunks, with source identity/content assertions.

**Why must evaluation and runtime share the same retrieval path?** Otherwise evaluation can
report improvements the user never receives. Both execute the same service, planning, gates and RRF;
scripted graph/tool checks additionally verify the production integration.

**What changed in the routing baseline?** Methodological explanations now precede incidental
record/module words while explicit write/current-data requests keep their operational path. The
preexisting record feature is preserved locally and excluded from the F.2 commit.
