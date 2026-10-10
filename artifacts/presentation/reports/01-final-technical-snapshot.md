# Final Technical Snapshot

Captured: 2026-08-10

| Layer | Verified implementation |
|---|---|
| Frontend | Angular 18 |
| Backend | Node.js + Express + TypeScript |
| Agent orchestration | LangGraph |
| Model provider used in live evidence | OpenAI |
| RAG | OpenAI embeddings + PostgreSQL pgvector |
| Database | PostgreSQL 16.14 |
| pgvector | 0.8.6 |
| Embedding model | `text-embedding-3-small` |
| Vector dimensions | 1536 |
| RAG documents / chunks | 4 / 4 |
| Backend tests | 154/154 PASS |
| Frontend tests | 7/7 PASS |
| Focused Harness tests | 5/5 PASS |
| Offline evaluation | 36/36 PASS |
| Live-safe subset | 9/9 PASS |
| HSE tables / operational rows | 42 / 784 preserved |

No credentials, vectors, system prompts or operational row payloads are included.
