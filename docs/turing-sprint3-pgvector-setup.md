# Sprint 3 — PostgreSQL + pgvector setup

## 1. Objective

Prepare the existing PostgreSQL 16 database for later RAG ingestion, without ingesting data,
calling an embeddings API, adding retrieval, changing LangGraph, or changing the Angular UI.

## 2. Previous database architecture

Repository inspection found a Node/Express backend using the `pg` driver and one
`DATABASE_URL`. There is no ORM. The baseline schema is the idempotent
`database/schema.sql`, with `SERIAL` keys, and seed data comes from `database/seed.js`.
There was no versioned migration ledger, pgvector extension, vector table, tenant field, or
database-level row security.

Live inspection on 2026-08-07 confirmed PostgreSQL 16.14 on `postgres:16-alpine`, database
`hse_app`, user `postgres`, container `hse-postgres`, port `5432:5432`, bridge networking and
restart policy `no`. Before activation, only `plpgsql` was installed. The database contained
42 public HSE tables and exactly 784 rows. No Dockerfile or Compose file is tracked.

## 3. New architecture

Versioned SQL files in `database/migrations` are applied in lexical order by
`database/migrate.js`. Applied names are recorded in `schema_migrations`. Each migration and
its ledger write run in one transaction. The operational HSE tables are untouched; RAG uses
two backend-only tables:

```text
rag_documents 1 ──────── * rag_chunks
   source identity          ordered content + vector(1536)
   module/title/version     document_id foreign key
   SHA-256 content hash     per-chunk metadata
```

## 4. Docker changes

The container image changed from `postgres:16-alpine` to `pgvector/pgvector:pg16`. PostgreSQL
remains 16.14. Because no repository Docker configuration exists, only the identified container
was recreated. Database name/user/password variables, `PGDATA`, port, network and restart policy
were preserved. No unrelated container was recreated.

Persistent storage before and after is the same Docker volume:

```text
name:        555a00e21ac71682f8b7ba36ff524a733aa0c53f0692bca31bc8f82bbd8ae719
source:      /var/lib/docker/volumes/555a00e21ac71682f8b7ba36ff524a733aa0c53f0692bca31bc8f82bbd8ae719/_data
destination: /var/lib/postgresql/data
PGDATA:      /var/lib/postgresql/data
```

The superseded stopped container was removed only after validation; the volume was retained and
re-inspected. No `down -v` or volume deletion command was used.

## 5. pgvector configuration

Migration `001_enable_pgvector_and_create_rag.sql` runs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This ran successfully using the existing database role. The installed pgvector version is
`0.8.6`.

## 6. Database migration

From `database/`, using the same connection string as the backend:

```powershell
$env:DATABASE_URL='<existing connection string>'
npm run migrate
npm run validate:pgvector
```

Migration `001_enable_pgvector_and_create_rag.sql` applied successfully at
`2026-08-07 15:45:59 UTC`. Never put the real connection string or API keys in source control.
The migration is additive:
it creates one extension, one ledger table, two RAG tables, and two B-tree indexes. It contains
no `DROP`, `TRUNCATE`, `DELETE`, or alteration of an existing HSE table.

## 7. RAG schema

`rag_documents` uses `BIGSERIAL`, consistent with the repository's sequence-backed integer
strategy while allowing growth. It stores source type/reference, HSE module, title, version,
SHA-256 content hash, JSON metadata, and timestamps. Uniqueness constraints support idempotent
source/version and source/hash checks.

`rag_chunks` stores ordered content, optional positive token count, `vector(1536)`, JSON
metadata, and a required foreign key to its document. A document/chunk-index uniqueness
constraint prevents duplicate chunk positions. Document deletion cascades only to its own RAG
chunks; no relationship targets an operational HSE table.

## 8. Embedding configuration

Defaults are centralized in `backend/src/ai/embedding.config.ts` and documented in
`backend/.env.example`:

```text
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

The SQL type must remain aligned with this setting. No key is added and no OpenAI request is
made in this sprint.

## 9. Traceability strategy

Every future result can follow `rag_chunks.document_id` to `rag_documents`, then cite
`source_type`, `source_reference`, `module`, `title`, `version`, and `chunk_index`. Source-specific
record IDs or paths can be placed in `source_reference`; non-sensitive supporting attributes may
use JSON metadata. No tenant/company/site column was invented because the current system has no
tenant ownership model. A future tenant design must add and enforce ownership before shared use.

## 10. Security considerations

- No frontend endpoint or backend route exposes the RAG tables.
- The migration contains static SQL; the runner parameterizes migration-ledger values.
- PostgreSQL grants no table access to `PUBLIC` by default, but the existing application role is
  also the apparent schema owner and therefore retains broad access.
- The application still lacks authentication, RBAC, tenant isolation, and row-level security.
  It must not be deployed as a multi-company RAG service in this state.
- HSE text and metadata may contain health, incident, personnel, or legal information. Future
  ingestion must minimize metadata, authorize before retrieval, and avoid logging content or
  embeddings.
- Secrets remain in environment variables and must never enter `metadata` or committed files.

## 11. Test results

Live validation on 2026-08-07:

- Docker engine and new container startup: PASS.
- PostgreSQL version: 16.14, PASS.
- pgvector extension version: 0.8.6, PASS.
- `schema_migrations`, `rag_documents`, `rag_chunks`: PASS.
- `vector(1536)` insert: PASS and rolled back.
- Valid document/chunk relationship: PASS; orphan rejection with SQLSTATE 23503: PASS.
- Original data: 42 tables and 784 rows before and after, PASS.
- Key counts: projects 12, incidents 11, manpower 84, lookup entries 245, PASS.
- Pre-migration image swap schema diff: zero normalized lines, PASS.
- Existing backend database connection: PASS.
- Application `/api/health`: PASS.
- Backend typecheck and production build: PASS.
- Complete backend suite: 39/39 PASS. The previously observed LangGraph step-limit failure did
  not recur; no LangGraph code was changed.

Backup created before container recreation:

```text
backups/yvy_hse_pre_pgvector_20260807_164311.dump (custom format, 123260 bytes, 290 TOC entries)
backups/yvy_hse_pre_pgvector_20260807_164311_schema.sql (55737 bytes)
```

The entire `backups/` directory is ignored by Git because it contains operational data.

`npm run validate:pgvector` checks the extension, both tables, accessibility of pre-existing
tables, a 1536-dimensional insert, and the document-to-chunk foreign key. Its writes occur in a
transaction that is always rolled back.

For future changes, capture schema and row-count evidence and repeat afterward:

```powershell
docker exec hse-postgres pg_dump -U postgres -d hse_app --schema-only > before-schema.sql
docker exec hse-postgres psql -U postgres -d hse_app -c "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables ORDER BY relname;"
```

The post-migration schema diff should contain only `vector`, `schema_migrations`,
`rag_documents`, `rag_chunks`, their sequences/constraints, and the two declared indexes.

## 12. Index and rollback considerations

No HNSW index is created initially. For the expected small corpus, exact cosine distance scans
are simpler and provide exact neighbours; HNSW adds build time, storage and approximate-search
tuning without a demonstrated latency need. When measured query latency warrants it:

```sql
CREATE INDEX rag_chunks_embedding_hnsw_idx
ON rag_chunks USING hnsw (embedding vector_cosine_ops);
```

Rollback should first back up the database, then drop only the two empty/new RAG tables and the
migration ledger entry if operationally necessary. Do not drop the `vector` extension while any
vector column exists. Never remove or recreate the PostgreSQL volume. Because the migration is
additive and transactional, the preferred rollback before ingestion is normally to leave the
empty structures in place.

## 13. Files changed

Created: `database/migrations/001_enable_pgvector_and_create_rag.sql`, `database/migrate.js`,
`database/validate-pgvector.js`, `backend/src/ai/embedding.config.ts`, its unit test, and this
document. Modified: `database/package.json`, `database/schema.sql`, `backend/.env.example`, and
`docs/architecture.md`.
