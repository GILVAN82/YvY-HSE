CREATE TABLE IF NOT EXISTS agent_long_term_memory (
  id UUID PRIMARY KEY,
  memory_key TEXT NOT NULL UNIQUE CHECK (memory_key ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  category TEXT NOT NULL CHECK (category IN ('WORKFLOW_PREFERENCE','PROJECT_CONTEXT','OPERATING_CONSTRAINT','DOMAIN_PREFERENCE')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_long_term_memory_active_hash_idx
  ON agent_long_term_memory (category, content_hash) WHERE enabled;
CREATE INDEX IF NOT EXISTS agent_long_term_memory_enabled_idx
  ON agent_long_term_memory (enabled, category);

COMMENT ON TABLE agent_long_term_memory IS
  'Explicit, application-scoped durable context; excludes transcripts, vectors, secrets, personal data, and operational records.';
