CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_session (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_session_user_idx ON app_session(user_id);
CREATE INDEX IF NOT EXISTS app_session_expiry_idx ON app_session(expires_at);

ALTER TABLE agent_thread_state ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_user(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS agent_thread_state_user_idx ON agent_thread_state(user_id);

ALTER TABLE agent_human_approval ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES app_user(id) ON DELETE SET NULL;
