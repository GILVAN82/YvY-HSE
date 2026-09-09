> **HISTORICAL / VERSIONED SPRINT EVIDENCE.** Preserve the measurements and source baseline below. The current consolidated authority is [Sprint H](SPRINT_H_FINAL_COMPLIANCE.md), [test strategy](TEST_STRATEGY.md), [requirements](TURING_REQUIREMENTS_MATRIX.md) and [review matrix](REVIEW_COMPLIANCE_MATRIX.md). Earlier counts, line numbers, readiness decisions and pending items are not current claims. No old live result validates the current model/prompt baseline.

# Sprint F — RAG production hardening

Sprint F.2 update: see [multilingual retrieval and baseline consistency](SPRINT_F2_MULTILINGUAL.md) for the current PT/EN policy, same-corpus before/after metrics and patch replay. Earlier results below remain historical.

Sprint F.1 update: the four approved sources have now been reingested and validated against PostgreSQL. See [approved corpus validation](APPROVED_CORPUS_VALIDATION.md) for real-corpus metrics, idempotence, external calls and remaining limits. The Sprint F observations below are historical.

## Audited starting point (79f3f41, before Sprint F changes)

The audit read `rag/ingestion.service.ts`, `textProcessing.ts`, `embedding.service.ts`,
`rag.repository.ts`, `retrieval.repository.ts`, `retrieval.service.ts`, `retrieval.config.ts`,
`sourceRegistry.ts`, migration 001, `productionDependencies.ts`, `tools.ts`, graph evidence,
agent/verification nodes, E.1 jurisdiction contract and evaluation provenance/executor.

Original path: question → trim/length and operational-intent check → one OpenAI embedding
→ PostgreSQL exact cosine search → similarity >= 0.45 → top 3 evidence chunks
→ `search_hse_knowledge` tool result → citation evidence → semantic verifier → HITL/finalization.

Four allowlisted public-reference Markdown summaries were normalized, paragraph-split and
embedded. Paragraph composition could append overlap without enforcing the final maximum;
unbroken oversized words could also exceed it. Persistence used BIGSERIAL IDs. Ingestion
skipped on content hash alone. Retrieval had no lexical branch, fusion or corpus/config
fingerprint. Rows were mapped without runtime validation. The E.1 answer evaluation used
synthetic evidence, not vector retrieval. These are observations from code, not assumptions
from the previous report.

## Implemented path

Question → operational-query exclusion → schema-validated deterministic query plan
→ vector candidates plus PostgreSQL lexical candidates → branch-specific relevance gates
→ existing E.1 jurisdiction gate → RRF → final top K → required-source completeness
→ evidence/citations → unchanged semantic verification and HITL.

The production composition already constructs `PostgresRagRetrievalRepository`; its new
lexical method therefore participates automatically. The optional method on the injected
repository interface preserves vector-only adapters and labels them `SEMANTIC_ONLY`.
Diagnostics survive graph state and are returned in Inspector metadata; the tool trace also
retains status. No visual changes or operational authorization changes are included.

### Chunks and identities

One window builder slices canonical text without deleting characters; offsets support exact
reconstruction despite overlap. Target 750, maximum 1000, overlap 100. Every output respects
`ceil(UTF-16 length / 4) <= maximum`, including overlap. Surrogate pairs are not split.
This is explicitly a character-based estimate, **not an exact multilingual model tokenizer**.
Windows may divide words; retaining hard bounds and lossless offsets was preferred to a
second paragraph splitter. Tests cover exact maximum, maximum+1, long paragraphs/sentences,
paragraph boundaries, overlap and multilingual Unicode.

Stable SHA-256 chunk identity includes source type/reference, document version/content hash,
position, chunk content, chunk/embedding/preprocessing configuration. It is stored as
`rag_chunks.metadata.stableChunkId`; retrieval uses it, falling back to the old numeric ID
for legacy rows. Numeric primary keys remain internal. Distinct source documents are never
collapsed just because their text matches. RRF deduplicates the same document/chunk only.

Ingestion skips only when content, version and ingestion fingerprint agree. Existing rows
without configuration identity require reingestion. All four stored content hashes differ from the current registered files (the stored hashes do match their stored text). No reingestion or paid embeddings were
run in this sprint. Legacy rows stay readable; stable IDs become active on reingestion.

The corpus manifest sorts all supplied documents and hashes identity, content hash, version,
provenance metadata, chunk config, provider/model/dimensions and preprocessing version.
It is returned by ingestion, including dry-run. It describes the input corpus, not a claim
that every document was successfully persisted; consult ingestion errors/counts separately.
The retrieval evaluation records its own complete synthetic corpus fingerprint. The existing
agent evaluation remains accurately labeled as a synthetic evidence adapter.

### Retrieval configuration and query preparation

`hybrid-v1`: semantic candidates 12, lexical candidates 12, final topK 3, semantic minimum
0.45, lexical meaningful-token coverage minimum 0.60, RRF k=60, dictionary `simple`, fusion
`RRF`, lexical fallback enabled, deterministic reformulation v1. Existing `RAG_TOP_K` and
`RAG_MIN_SIMILARITY` settings remain supported. Validated configuration has a canonical hash.
Changing fusion for comparison produces a distinct mode hash; the common comparison config
and dataset/corpus/commit are shared. No environment files were changed.

The query plan explicitly models original/semantic/lexical query, exact terms, acronyms and
optional jurisdiction/domain. Current preparation preserves the original query and extracts
identifiers/acronyms; it does not invent expansions or jurisdictions. No LLM reformulation is
used, so no user input is interpolated into system instructions. A malformed plan or typed
reformulation failure falls back to the original semantic and lexical query and reports
`FALLBACK_ORIGINAL`. Programming errors propagate. If a future LLM planner is added, it must
use structured output with independent system instructions and user-data messages.

### Lexical search, fusion and relevance

PostgreSQL `simple` full-text vectors and OR-composed parameterized `plainto_tsquery` terms
retrieve acronym/code candidates. No user SQL interpolation occurs. Candidate recall is
deliberately broader than acceptance: the service checks meaningful exact-token coverage
against content and requires extracted exact identifiers to be present in both branches, then applies jurisdiction constraints for legal claims. A lexical match
alone does not establish normative authority. The small hermetic comparator injects a token
coverage fake; it does not pretend to measure PostgreSQL ranking.

RRF adds `1/(60+rank)` per branch, never raw similarity plus lexical score. Duplicate hits
contribute once per branch, ties break deterministically by document/chunk. Semantic rank,
lexical rank, fusion score, citation label, source, document, chunk, version, jurisdiction
and URL remain available. Required A+B with only A returns `PARTIAL_REQUIRED_EVIDENCE` and
no answer evidence; evaluation independently checks every required source.

Expected modes: HYBRID, SEMANTIC_ONLY, LEXICAL_FALLBACK. Relevance states: RELEVANT_EVIDENCE,
NO_RELEVANT_EVIDENCE, RETRIEVAL_UNAVAILABLE, LEXICAL_FALLBACK, PARTIAL_REQUIRED_EVIDENCE.
The legacy successful tool envelope remains `status: OK`; diagnostics distinguish fallback.
Unavailable infrastructure is an error response, not a successful empty data result.
Insufficient evidence is withheld for abstention; generation still must pass verification.

Embedding/vector infrastructure failure permits lexical-only execution only under policy.
Insufficient lexical evidence during outage reports RETRIEVAL_UNAVAILABLE. Lexical outage
may retain qualified semantic evidence and labels execution SEMANTIC_ONLY. Narrow classes:
EmbeddingProviderError, LexicalRetrievalError, VectorRetrievalError, RetrievalConfigError,
MalformedRetrievalRowError and ReformulationError. Transport/server failures are classified
near the source; malformed data, invalid configuration and programming faults are not
converted to “no evidence”. The existing outer tool boundary emits a safe controlled error.

E.1 jurisdiction verification remains authoritative: foreign evidence may explain a general
principle but cannot establish another jurisdiction's law. Unknown/unspecified legal scope
abstains. The recognizer has a finite supported vocabulary; this is not legal equivalence
reasoning or a complete multilingual legal classifier.

## ANN INDEX DEFERRED

Read-only local audit on 2026-09-09: **4 documents, 4 chunks, pgvector 0.8.6**.
The approved source registry also contains four documents and canonical rebuilding produces
four chunks. There is no measured growth forecast or latency bottleneck. Exact cosine search
avoids approximate-recall loss; HNSW/IVFFlat would add build/memory/tuning/maintenance cost
without demonstrated value. Lexical search also computes vectors directly at this scale.
Revisit with measured corpus growth, query latency, recall and write frequency; benchmark
exact search versus ANN and a lexical GIN index before a migration. No index added by checklist.

Read-only SQL smoke exercised the actual PostgreSQL adapter: LOTO retrieved the LOTO source,
PTW retrieved the PTW source, an absent EQ-123 returned none, and SQL-like punctuation remained
parameter data. This is an integration smoke, not a labeled real-corpus relevance benchmark.

## Limits and follow-up

The corpus contains curated summaries, not official full legal texts. The deployment still
needs intentional reingestion to activate new stable IDs/config identity for legacy rows.
No live model/embedding quality claim is made. Semantic threshold and lexical coverage need
calibration on a larger adjudicated real-corpus dataset. The synthetic comparison exposes
irrelevant semantic candidates that RRF reorders but does not remove. Do not interpret a
high synthetic recall as production completeness. No Turing Demo Mode was started.
