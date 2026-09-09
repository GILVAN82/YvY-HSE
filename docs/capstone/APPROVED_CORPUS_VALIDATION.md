# Sprint F.1 — Approved corpus reingestion and retrieval validation

The four approved repository summaries are now synchronized with PostgreSQL. Canonical
ingestion updated their content, embeddings, ingestion fingerprints and stable chunk IDs.
Document count and chunk count remain **4 / 4**. A second ingestion skipped all four sources,
made no embedding requests and preserved the complete logical snapshot, including numeric IDs.

No approved sources were added, removed or edited. No operational tables, authorization,
HITL, prompts, retrieval thresholds or `.env` files were changed. No Sprint G or Demo Mode.

## Before and after

[Pre-ingestion audit](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/before.json)
contains the approved registry, complete input manifest, manually labeled dataset, stored
document/chunk IDs, hashes, counts, configuration and the local backup location.
Every source was `CONTENT_CHANGED`; none was missing, unexpected or version-changed.

The local pre-ingestion backup retains RAG IDs, source/version/hash metadata, chunk content
and vectors. It is a RAG content/vector snapshot, not a whole-database dump or a backup of
operational tables. The pipeline replaces each document transactionally; it does not promise
a single transaction across four documents. It reports failures and leaves the audit/backup
available for deliberate recovery instead of silently claiming successful synchronization.

[Post-ingestion validation](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/after.json)
checks actual stored text against every canonical chunk, stored hash, version, provenance,
embedding dimensions, offsets and stable identity. It reconstructs documents and independently
compares the resulting corpus fingerprint with the approved-file manifest. Counts alone are
not used as proof of equivalence.

| Source | Document ID | Previous numeric chunk | New numeric chunk | Before → after |
|---|---:|---:|---:|---|
| LOTO / OSHA | 7 | 13 | 59 | CONTENT_CHANGED → MATCH |
| PTW / HSE | 8 | 14 | 60 | CONTENT_CHANGED → MATCH |
| Risk Assessment / HSE | 9 | 15 | 61 | CONTENT_CHANGED → MATCH |
| Emergency / HSE | 10 | 16 | 62 | CONTENT_CHANGED → MATCH |

The snapshot fingerprint changed from
`e1ce0d9f2a3410eb2d2f46a625c593758bab43487591a5205386f75437531971` to
`1e1b1c1c1e9273cb70814da4472917b532904aca1b66de295aa1344e88e4745a` because
content, chunk IDs and processing/provenance metadata changed. This snapshot hash includes
storage identities; it is distinct from the canonical corpus fingerprint below.

Canonical approved/indexed corpus fingerprint:
`cd19ac92e204c7f9e7ee59bec8af925ad8cbd898b271a765d782a32a3dc4f6a1`.

Embedding configuration: **OpenAI / text-embedding-3-small / 1536 dimensions**.
Configuration fingerprint:
`8409d0f783f63f92d3d02fe8da09b4350ed2ce50a0f13532e7892a217cade5e2`.

The provider/model were read from the existing configuration and were not switched.
[HTTP ledger](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/external-calls-2026-09-09T16-48-28-790Z.json):
**5 successful requests** to `/v1/embeddings`: four canonical document batches (one chunk each),
then one batch of 16 query vectors. Twenty texts were embedded. No generation-model API calls
were made. Both modes and all threshold probes reused the same query vectors. Reingestion
repeat and subsequent validation/replay made **zero** additional HTTP requests.

## Real-corpus evaluation

Ground truth was manually defined from the four approved files before inspecting retrieval:
16 questions, **12 EN / 4 PT**, 14 answerable and two negative/trap queries, with 16 required
source occurrences. Each case records its supporting source section and explicit required,
relevant and irrelevant labels. The retriever did not generate those labels. The two
multi-source cases distinguish LOTO from PTW and connect risk assessment with PTW.

All evaluations use **REAL APPROVED CORPUS**, **REAL EMBEDDINGS** and **REAL POSTGRESQL lexical
retrieval**. Each comparison keeps queries, labels, corpus, vector cache, common configuration
and source baseline constant; only semantic-only versus RRF changes. The mode fingerprints
therefore legitimately differ in the fusion setting. There was no answer-quality benchmark.

Two source baselines are explicitly retained. The integrated workspace includes preexisting
local changes which are outside this commit. The isolated Sprint baseline contains only F.1
on top of `14e3c47`. Do not mix the two baselines to claim a retrieval improvement.

| Metric at threshold 0.45, K=3 | Integrated semantic | Integrated hybrid | Isolated semantic | Isolated hybrid |
|---|---:|---:|---:|---:|
| Required Source Recall | 62.50% | 68.75% | 68.75% | 75.00% |
| Relevant Source Recall@3 | 62.50% | 68.75% | 68.75% | 75.00% |
| Irrelevant Retrieval Rate | 0% | 0% | 0% | 0% |
| MRR | 0.5714 | 0.6429 | 0.6429 | 0.7143 |
| Top-1 Source Accuracy | 57.14% | 64.29% | 64.29% | 71.43% |
| Answerable queries with no evidence | 6 | 5 | 5 | 4 |

Recall micro-averages unique source hits over labeled source totals. Irrelevant rate divides
labeled irrelevant unique-source hits by all retrieved unique sources. MRR and top-1 average
over the 14 answerable queries; the two negatives are assessed separately. No-evidence counts
include routing exclusions; the per-case report distinguishes `NOT_APPROPRIATE` from abstention.

Observed lexical value: the question about eliminating hazards before substitution, reduced
exposure and PPE had no accepted semantic source at 0.45, while hybrid returned the Risk
Assessment source at rank 1. This is an absent → rank-1 gain. No ordering reversal among
shared accepted sources was observed at the baseline. OSHA 1910.147, PTW/HSG250 and LOTO
already found their primary sources semantically; no additional ranking gain is claimed there.

All four PT questions lacked accepted evidence at 0.45. The corpus is English and the current
lexical branch has no cross-language expansion. This is a measured coverage limitation,
not a claim that the real embedding model supports no Portuguese.

The integrated-only extra miss is the risk-management-cycle question containing “record”.
A preexisting local `PREPARE_RECORD` route includes `get_projects`, causing the RAG operational
exclusion to reject it. The isolated Sprint routes that question to knowledge successfully.
The local routing behavior was preserved and is explicitly a remaining integration issue.

Authoritative detailed reports:
- [Integrated workspace](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/retrieval-2026-09-09T16-56-36-739Z.json)
- [Isolated Sprint](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/retrieval-2026-09-09T16-56-49-420Z.json)
- [Replay](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/retrieval-2026-09-09T16-58-03-948Z.json)

Earlier timestamped reports are retained as historical runs, not substituted for these final
source-fingerprinted reports. The initial live run predates the later Inspector/replay checks.

## Threshold decision

**Keep 0.45, with limitations.** Probes reused cached vectors and did not tune the dataset.

| Hybrid threshold | Integrated required recall / irrelevant rate | Isolated required recall / irrelevant rate |
|---|---|---|
| 0.35 | 87.50% / 30.00% | 93.75% / 34.78% |
| 0.45 | 68.75% / 0% | 75.00% / 0% |
| 0.55 | 56.25% / 0% | 62.50% / 0% |

Lowering the threshold reduces missed evidence but admits unrelated sources. Raising it loses
more required sources without an observed precision benefit. Keeping 0.45 is a conservative
trade-off, not a universally calibrated optimum. This tiny, manually labeled set has no held-out
split or confidence intervals. More multilingual and near-miss queries are needed before
changing production defaults. Retrieval config remains `hybrid-v1`, fingerprint
`5824e17941c1f254b79c1b975197f8c5effb2bbf0ef1b6a91ee827a66675b9b3`.

## Failure behavior and provenance

Injected embedding outage against real PostgreSQL produced `LEXICAL_FALLBACK` and a traceable
LOTO hit. The astronomy query produced `NO_RELEVANT_EVIDENCE` with both branches available.
The wrong-jurisdiction query did not treat OSHA as authority for Portuguese law.

The actual graph/Inspector output was exercised with scripted model responses and the real
repository: `HYBRID`, `SEMANTIC_ONLY`, `LEXICAL_FALLBACK` and `NO_RELEVANT_EVIDENCE` all matched
their execution paths. This tests diagnostics transport, not generated-answer quality or a
real provider outage. Existing authorization, verification and HITL gates remain in force.

Citation → stable chunk → stored document → approved source → version → jurisdiction/URL
checks passed, with at least one baseline hybrid hit per approved document.

## Reproduction and operational use

From `backend`, `npm run rag:approved:validate` performs audit and dry-run only. It snapshots
RAG state and never embeds. `--confirm-live --run-dir <audited-directory>` explicitly enables
canonical ingestion and minimal real query embeddings, rejecting changed inputs or unexpected
database drift. A recorded ingestion cannot be silently repeated by that command.

`--evaluate-cached --run-dir <directory>` validates current database content and vectors,
reuses the retained cache and blocks HTTP. It requires PostgreSQL to contain the matching
indexed corpus. Credentials must be supplied locally; none are stored in artifacts.

[Retained public-source/query vectors](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/real-embedding-cache.json)
have cache fingerprint `44f23908904c7ec83d95722bcf1862872e785611d505ab73ce628673f22dee01`.
These are measurements from the real provider, not fabricated fixtures. They preserve the
exact evaluated vectors; fresh provider calls need not reproduce floating-point output forever.

[Reproduction verification](../../artifacts/evaluation/f1-2026-09-09T16-47-48-437Z/reproduction.json)
records a fresh checkout plus the retained source patch. Eleven agent source/config fingerprints,
all retrieval observations, corpus, query-vector and stored-vector fingerprints matched.
No additional HTTP calls were needed. Database credentials and the original pre-ingestion
backup remain local; the commit includes evaluation data, not an automatic database migration.

## Regression and review dashboard

Backend: **371/371 integrated**, **353/353 isolated**. The difference is 18 preexisting local
tests outside F.1. Frontend: **117/117**. Backend typecheck/build, frontend app/spec typechecks
and production build passed. Existing frontend size warnings remain; no budget was increased.
Hermetic tests need no keys, database or internet. New tests run the four actual approved files
through canonical ingestion with injected mock embeddings, then verify idempotence/tampering.

Agent baseline **44/44**, supplementary **3/3**, intent **134/134**.
[Agent artifact and source patch metadata](../../artifacts/evaluation/2026-09-09T16-56-42-761Z-14e3c4756eb6-offline.json).

| Perspective | Status and evidence | Remaining |
|---|---|---|
| TURING | 🏁 VALIDATED — real-corpus RAG, evaluation and grounding trace | 🟡 REMAINING — broader multilingual quality |
| JOCHEN | 🏁 VALIDATED — approved-source grounding for all four documents | 🟡 REMAINING — answer quality beyond scripted checks |
| VYTAUTAS | 🏁 VALIDATED — hybrid/RRF, corpus identity, required/relevant labels, threshold trade-offs and replay | 🟡 REMAINING — held-out relevance calibration |
| ERIKAS | 🏁 VALIDATED — unchanged config plus explicit fingerprints and vector cache | ✅ IMPLEMENTED — reproducible validation command |
| ANDRIUS | 🏁 VALIDATED — false retrieval versus false abstention documented | 🟡 REMAINING — larger sample before threshold change |
| JUSTINAS | 🏁 VALIDATED — injected outage with real lexical repository and Inspector trace | 🟡 REMAINING — real provider-outage exercise |
| FATIMA | 🏁 VALIDATED — stable identity, explicit snapshots and persisted-field assertions | ✅ IMPLEMENTED — integrity checks before cached replay |

⬜ MISSING from this evaluation: held-out multilingual benchmark and live generation-quality
evaluation. These are disclosed limits, not uncompleted corpus synchronization. Statuses map
evidence to review topics; they do not assert endorsement by individual reviewers.

## Defence note

**Why reingest?** Stored texts differed from approved files and had no new configuration/stable
identity metadata. Keeping old vectors would measure a different corpus from the repository.

**How do we know they match?** Compare every persisted chunk, content hash, version, source
metadata, offset and dimension; reconstruct the corpus; compare fingerprints; repeat ingestion
without changes or extra embeddings. Counts alone would not prove this.

**What changed from semantic-only to hybrid?** PostgreSQL lexical candidates provide an
independent exact-term signal; RRF combines rankings without adding incompatible raw scores.
At 0.45, one Risk Assessment query gained a required source that semantic-only withheld.

**Did every metric improve?** No. Required/relevant recall, MRR and top-1 improved within each
baseline. Irrelevant retrieval stayed at zero. Four Portuguese questions still missed evidence.

**Why defer ANN?** Four chunks do not establish a latency or growth problem. Exact pgvector
search avoids approximate-recall loss and index maintenance. No ANN migration was added.

**What are the limits?** Four English curated summaries, sixteen manual questions, no held-out
sample, strict labels, injected rather than actual outage, and scripted rather than live answer
generation. Results describe this baseline and should not be advertised as a universal benchmark.

## Approved registry and final stable identities

Registry eligibility is explicit (`enabled=true`, `public-reference`); all files are curated summaries, not official full texts or a new legal approval. No separate signed approval record is asserted.

### yvy-kb-loto-osha-1910-147

- File: [knowledge/approved/01_loto_osha.md](../../knowledge/approved/01_loto_osha.md)
- Version: `YvY-curated-summary-v1.0`
- Jurisdiction: United States - Federal General Industry
- Document hash: `0a96b61f4551459cc4a9527c6eca71f618e1259a6c8af4d460c9f796009c088c`
- Stable chunk ID: `de68ad64379ff409920ff55f3cde2f18a3b6dc10ab25c6e831cc48889bf155c2`
- Organization: Occupational Safety and Health Administration (OSHA)
- Registry metadata: enabled `true`, sensitivity `public-reference`, content status `curated_summary_not_official_text`, accessed `2026-08-08`.

### yvy-kb-ptw-hse-hsg250

- File: [knowledge/approved/02_permit_to_work_hse.md](../../knowledge/approved/02_permit_to_work_hse.md)
- Version: `YvY-curated-summary-v1.0`
- Jurisdiction: United Kingdom
- Document hash: `a0f9ed68042c5bc814ef483a5cc4039fb6680e73fb86068a353981c8e9217fdf`
- Stable chunk ID: `e83a3e693ca7bda16d0c59ff165ad5a1786d58df20deaa84197d96ffd92a4253`
- Organization: UK Health and Safety Executive (HSE)
- Registry metadata: enabled `true`, sensitivity `public-reference`, content status `curated_summary_not_official_text`, accessed `2026-08-08`.

### yvy-kb-risk-assessment-hse

- File: [knowledge/approved/03_risk_assessment_hse.md](../../knowledge/approved/03_risk_assessment_hse.md)
- Version: `YvY-curated-summary-v1.0`
- Jurisdiction: United Kingdom
- Document hash: `0bc8bd1d43c884065b77293f406ff8fbf7065e1bfad78a5c67fb20176bcf2f44`
- Stable chunk ID: `b3f36fecaee791ba61bb9a6134907da57c4072affec30d6acfbef03b5d05b131`
- Organization: UK Health and Safety Executive (HSE)
- Registry metadata: enabled `true`, sensitivity `public-reference`, content status `curated_summary_not_official_text`, accessed `2026-08-08`.

### yvy-kb-emergency-procedures-hse

- File: [knowledge/approved/04_emergency_procedures_hse.md](../../knowledge/approved/04_emergency_procedures_hse.md)
- Version: `YvY-curated-summary-v1.0`
- Jurisdiction: United Kingdom
- Document hash: `29d977a65dcf01089b2946087230e8dfb5f0ac82706863c9ec69cff42ab3704a`
- Stable chunk ID: `7b559d27594ada05b9fb5fa7a1cf92f265251eabddbdc4f74886ecb79a52d4bc`
- Organization: UK Health and Safety Executive (HSE)
- Registry metadata: enabled `true`, sensitivity `public-reference`, content status `curated_summary_not_official_text`, accessed `2026-08-08`.
