CREATE TABLE IF NOT EXISTS yvy_attention_scheduler_run (
  id UUID PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK(status IN('RUNNING','COMPLETED','PARTIAL','FAILED','SKIPPED')),
  duration_ms INTEGER,
  scopes_evaluated INTEGER NOT NULL DEFAULT 0,
  sources_evaluated INTEGER NOT NULL DEFAULT 0,
  alerts_created INTEGER NOT NULL DEFAULT 0,
  alerts_updated INTEGER NOT NULL DEFAULT 0,
  alerts_resolved INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  safe_errors JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS yvy_attention_run_started_idx ON yvy_attention_scheduler_run(started_at DESC);
