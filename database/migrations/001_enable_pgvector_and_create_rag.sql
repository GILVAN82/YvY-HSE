CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  id               BIGSERIAL PRIMARY KEY,
  source_type      TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  module           TEXT NOT NULL,
  title            TEXT NOT NULL,
  version          TEXT NOT NULL DEFAULT '1',
  content_hash     TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_reference, version),
  UNIQUE (source_type, source_reference, content_hash)
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id          BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content     TEXT NOT NULL CHECK (length(content) > 0),
  token_count INTEGER CHECK (token_count IS NULL OR token_count > 0),
  embedding   vector(1536) NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS rag_documents_module_idx ON rag_documents (module);
CREATE INDEX IF NOT EXISTS rag_chunks_document_id_idx ON rag_chunks (document_id);

COMMENT ON COLUMN rag_documents.content_hash IS
  'Lowercase SHA-256 of canonical document content, used to detect unchanged or changed sources.';
COMMENT ON COLUMN rag_chunks.embedding IS
  'OpenAI text-embedding-3-small vector; dimension is centrally configured as EMBEDDING_DIMENSIONS=1536.';
