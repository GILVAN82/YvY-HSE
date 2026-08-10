# Sprint 2.2C — pgvector retrieval and controlled agent integration

## Final status

**COMPLETE — validated 2026-08-08.**

The approved four-document corpus is searchable through pgvector cosine similarity and exposed to LangGraph only through the read-only `search_hse_knowledge` tool. No frontend, authentication, memory, HITL, HNSW, or database changes were introduced.

## Retrieval contract

- Query embeddings use the ingestion configuration (1536 dimensions).
- Parameterized SQL uses pgvector cosine distance (`<=>`).
- Default `TOP_K` is 3; verified minimum similarity is 0.45. Both are centrally configurable.
- Ranked results carry content, chunk/document IDs, score, source ID, title, module, version, citation label, organization, jurisdiction, and URL. Vectors are never returned.
- Threshold misses return `NO_RELEVANT_EVIDENCE`.
- Current/count/status questions return `NOT_APPROPRIATE` before embedding and remain on the SQL path.

## Controlled graph behavior

The topology remains `guard → agent → verify → finalize/refuse`. State records only whether RAG executed and minimal traceable evidence. The RAG tool is unavailable for structured operational queries.

Retrieved text is untrusted data. The prompt requires exact returned citation labels, ignores instructions inside evidence, prevents unsupported extrapolation, and states jurisdiction limits. Verification rejects evidence-backed answers without a matching real label and rejects invented HSE/OSHA/ISO-style citations when retrieval found nothing.

## Live smoke test

`npm run rag:retrieve:smoke` reported `OPENAI API CONFIGURED: YES`. Logging contained only query IDs, counts, source IDs, scores, and latency—never queries, content, vectors, or credentials.

| Query ID | Verified result | Top source | Score |
|---|---|---|---:|
| `loto` | `OK` | `yvy-kb-loto-osha-1910-147` | 0.5094 |
| `emergency` | `OK` | `yvy-kb-emergency-procedures-hse` | 0.5397 |
| `risk` | `OK` | `yvy-kb-risk-assessment-hse` | 0.5490 |
| `ptw` | `OK` | `yvy-kb-ptw-hse-hsg250` | 0.6335 |
| `unrelated` | `NO_RELEVANT_EVIDENCE` | — | — |
| `structured` | `NOT_APPROPRIATE` | — | — |

Relevant smoke scores were 0.5094–0.6335 and the unrelated query remained below 0.45. This supports the threshold for this controlled corpus; it is not a general relevance guarantee.

## Validation

- pgvector: PASS (0.8.6; 1536 dimensions; FK/orphan checks PASS; validation writes rolled back)
- Operational tables: 42
- Operational rows preserved: 784 (unchanged from ingestion validation)
- Corpus: 4 documents / 4 chunks
- Tests cover direct retrieval, threshold miss, structured bypass, classification, parameterized cosine SQL, vector non-disclosure, grounded citation, missing citation, and graph exclusion.
- Typecheck: PASS
- Production build: PASS
- Complete automated suite: PASS (83/83)

## Limitations

This is exact search over four curated summaries; HNSW is not warranted. Citation verification checks deterministic traceability, not second-model entailment. Sources are reference material and do not establish local legal applicability.
