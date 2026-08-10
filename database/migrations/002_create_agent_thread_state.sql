CREATE TABLE IF NOT EXISTS agent_thread_state (
  thread_id UUID PRIMARY KEY,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_thread_state_updated_at_idx ON agent_thread_state (updated_at);

COMMENT ON TABLE agent_thread_state IS
  'Minimal short-term LangGraph conversation continuity; never stores embeddings, secrets, prompts, or raw tool results.';
