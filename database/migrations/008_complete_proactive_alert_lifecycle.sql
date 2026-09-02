ALTER TABLE yvy_proactive_alert
  ADD COLUMN IF NOT EXISTS last_visual_notification_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_voice_notification_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notification_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_eligible_notification_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS yvy_proactive_alert_event (
  id UUID PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES yvy_proactive_alert(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('EVALUATED','CREATED','UPDATED','SEVERITY_CHANGED','SURFACED','VOICE_QUEUED','VOICE_SPOKEN','ACKNOWLEDGED','SNOOZED','RESOLVED')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO','ATTENTION','HIGH','CRITICAL')),
  category TEXT NOT NULL,
  source_type TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS yvy_alert_event_user_created_idx ON yvy_proactive_alert_event(user_id,created_at DESC);
