> **HISTORICAL / VERSIONED SPRINT EVIDENCE.** Preserve the measurements and source baseline below. The current consolidated authority is [Sprint H](SPRINT_H_FINAL_COMPLIANCE.md), [test strategy](TEST_STRATEGY.md), [requirements](TURING_REQUIREMENTS_MATRIX.md) and [review matrix](REVIEW_COMPLIANCE_MATRIX.md). Earlier counts, line numbers, readiness decisions and pending items are not current claims. No old live result validates the current model/prompt baseline.

# Retrieval evaluation — Sprint F

Sprint F.2 update: see [multilingual retrieval and baseline consistency](SPRINT_F2_MULTILINGUAL.md) for the current PT/EN policy, same-corpus before/after metrics and patch replay. Earlier results below remain historical.

Sprint F.1 update: the four approved sources have now been reingested and validated against PostgreSQL. See [approved corpus validation](APPROVED_CORPUS_VALIDATION.md) for real-corpus metrics, idempotence, external calls and remaining limits. The Sprint F observations below are historical.

Run from `backend`: `npm run eval:retrieval`. Default evaluation blocks sockets/fetch and
requires no database, provider key or internet. It writes an immutable timestamped JSON
artifact with source/commit/dataset/corpus/config fingerprints. `npm run eval:offline`
remains the separate answer-generation/agent baseline.

Dataset v1: 6 queries, 3 synthetic source documents, explicit required/relevant/irrelevant
source sets and a wrong-jurisdiction case. MOCK EMBEDDINGS use two deterministic dimensions
with an intentional LOTO/PTW collision. Lexical ranking is an injected token-coverage fake,
not PostgreSQL. Both arms execute the real retrieval service, relevance gates and RRF using
the same dataset/corpus/source baseline and common configuration; only fusion mode changes.

| Measured metric | Semantic-only | Hybrid + RRF |
|---|---:|---:|
| Required Source Recall | 100% | 100% |
| Relevant Source Recall@3 | 100% | 100% |
| Irrelevant Retrieval Rate | 16.67% | 16.67% |
| MRR | 0.875 | 1.000 |
| Top-1 Source Accuracy | 75% | 100% |

Only ranking improved on this fixture. Recall and irrelevant retrieval did not improve.
The comparator retains per-case failures instead of hiding them behind aggregate recall.
In particular, semantic collisions still add irrelevant results. These are regression and
failure-mode measurements, not evidence of live provider quality or general superiority.

Definitions: recall ratios micro-average unique source hits over labeled source totals.
Irrelevant rate is labeled irrelevant unique-source hits divided by all retrieved unique
sources. MRR and top-1 average only the four queries with nonempty relevant-source labels;
the two abstention cases are checked separately. Ranking collapses repeated chunks of the
same source to the first occurrence. A required A+B case retrieved only A fails regardless
of its first relevant result. A no-evidence case is not counted as an artificial top-1 success.

The real PostgreSQL smoke and observed 4-document/4-chunk corpus are described in
[RAG architecture](RAG_HARDENING.md); they are deliberately separate from these synthetic metrics.
The ingestion dry-run emits the complete registered-corpus manifest. No real embeddings
were generated and no paid provider calls were made for this sprint.

Reproducibility: the final agent evaluation's retained source patch reconstructs the shared
backend source baseline (including retrieval evaluation) from the recorded base commit.
Apply it to that commit, install lockfile dependencies, then run both evaluation commands.
Compare source/dataset/corpus/config fingerprints and case observations; timestamps and
working-directory paths naturally differ. Validation artifact references are in the Sprint F
dashboard.
