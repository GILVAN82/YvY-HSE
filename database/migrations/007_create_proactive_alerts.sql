CREATE TABLE IF NOT EXISTS yvy_proactive_alert (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO','ATTENTION','HIGH','CRITICAL')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('OPERATIONAL_DATA','HITL')),
  source_id TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  rule_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ALERTED','ACKNOWLEDGED','RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alerted_at TIMESTAMPTZ, acknowledged_at TIMESTAMPTZ, acknowledged_by_user_id UUID REFERENCES app_user(id), resolved_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  UNIQUE(user_id,fingerprint)
);
CREATE INDEX IF NOT EXISTS yvy_alert_user_status_idx ON yvy_proactive_alert(user_id,status,severity,created_at DESC);
