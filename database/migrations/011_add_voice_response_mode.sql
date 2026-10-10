ALTER TABLE app_user_voice_preferences
  ADD COLUMN IF NOT EXISTS voice_response_mode TEXT NOT NULL DEFAULT 'VOICE_INPUT_ONLY'
  CHECK(voice_response_mode IN ('OFF','VOICE_INPUT_ONLY','ALL_RESPONSES'));
