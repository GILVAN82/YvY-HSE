CREATE TABLE IF NOT EXISTS app_user_voice_preferences (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  engine TEXT NOT NULL CHECK(engine IN ('ELEVENLABS','BROWSER')),
  language_locale TEXT NOT NULL CHECK(language_locale IN ('pt-PT','pt-BR','en','es','fr','de')),
  gender_profile TEXT NOT NULL CHECK(gender_profile IN ('FEMALE','MALE','UNKNOWN')),
  voice_id TEXT,
  voice_name TEXT,
  speed NUMERIC NOT NULL CHECK(speed BETWEEN 0.7 AND 1.2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A short reservation prevents concurrent tabs from announcing the same alert.
-- Delivery cooldown is updated only after completed playback.
ALTER TABLE yvy_proactive_alert ADD COLUMN IF NOT EXISTS voice_claim_until TIMESTAMPTZ;

ALTER TABLE yvy_proactive_alert ADD COLUMN IF NOT EXISTS voice_claim_token UUID;
