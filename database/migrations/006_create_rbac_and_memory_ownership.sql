ALTER TABLE app_user ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'HSE_USER'
  CHECK (role IN ('ADMIN','HSE_MANAGER','HSE_USER','APPROVER'));

CREATE TABLE IF NOT EXISTS app_user_project (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_code TEXT NOT NULL REFERENCES projects(code) ON DELETE CASCADE,
  PRIMARY KEY(user_id,project_code)
);

ALTER TABLE agent_long_term_memory ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_user(id) ON DELETE CASCADE;
ALTER TABLE agent_long_term_memory DROP CONSTRAINT IF EXISTS agent_long_term_memory_memory_key_key;
DROP INDEX IF EXISTS agent_long_term_memory_memory_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS agent_memory_user_key_idx ON agent_long_term_memory(user_id,memory_key) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS agent_memory_user_active_idx ON agent_long_term_memory(user_id,enabled);
