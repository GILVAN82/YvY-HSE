# RAG and No-Evidence Evidence

Real UI citation evidence: `../screenshots/03-rag-loto-citation.png`

| Check | Result |
|---|---|
| Question | `What precautions should be taken before performing lockout/tagout?` |
| Tool | `search_hse_knowledge` |
| Source | `OSHA 29 CFR 1910.147 - LOTO` |
| Citation visible | YES |
| Jurisdiction qualified | YES — United States reference |
| Embeddings/vectors exposed | NO |

No-relevant-evidence fallback is covered by the current live-safe report and automated RAG tests. It returns no fabricated citation when evidence is below the 0.45 similarity threshold.
