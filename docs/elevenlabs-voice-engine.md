> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Earlier design, validation counts and capability descriptions below belong to their original sprint baseline. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# YvY ElevenLabs Voice Engine

The existing STT, agent, verification, formatter and detailed visual response remain
in place. Only the formatter's short spoken response goes to `VoiceEngineService`.
Conversation, replay and proactive summaries share this service. Preview uses the
same playback path with an unsaved preference snapshot, separate from normal replay.

## Backend and transport

Authenticated, AI_USE-protected endpoints:

- GET `/api/ai/voice/voices`: account catalog, projected official metadata.
- POST `/api/ai/voice/synthesize`: short text, voice ID, locale, speed, preview flag.
- GET/PUT `/api/ai/voice-preferences`: ownership comes exclusively from the session.

The backend uses native fetch against the official `/v2/voices` and
`/v1/text-to-speech/{voice_id}/stream` APIs. It never returns the API key or raw
upstream errors. Model configuration is centralized in the adapter. Multilingual
v2 does not support `language_code`; other models receive the base language code.
PT-PT/PT-BR remain distinct preferences, with accent metadata used for selection.
An exact accent cannot be guaranteed if the catalog does not identify it.

This increment consumes the upstream stream into a bounded in-memory buffer and
returns audio/mpeg. The frontend creates a temporary Blob URL and revokes it on
completion, replacement or stop. No audio is written to disk. Full binary response
is deliberate for predictable authenticated POST playback and fallback before any
audio starts; progressively feeding MediaSource can be added behind this service.

Limits: 1,200 characters per spoken response, 240 for preview, 4 MiB audio,
20-second upstream request timeout, 30-second client timeout and 12 syntheses per
minute per authenticated user. The catalog is capped at 20 pages of 100 voices.
Voice IDs are validated against account availability. Speeds are 0.7–1.2.
Tables/JSON/URLs are rejected by the speech endpoint, not sent as visual content.

Missing/disabled provider, auth errors at the provider, missing voices, rate limits,
timeouts, transport and playback failures trigger at most one browser fallback.
Content validation/provider content rejection does not. Inspector exposes only
requested engine, effective engine and a sanitized fallback reason. A browser
chosen explicitly is identified as browser fallback with reason USER_SELECTED.

## Preferences and lifecycle

Migration 010 adds `app_user_voice_preferences`, keyed by app_user ID, and short
alert voice reservations. No keys, audio or spoken text are stored in this table.
Replay synthesizes the last normal spoken response with the current saved
preference. Preview does not save preferences or overwrite normal replay/history.
Mute prevents synthesis requests. Stop aborts fetch, stops playback and invalidates
late callbacks. Logout/account changes clear preferences, replay and audio in memory.

Official gender labels map to FEMALE, MALE or UNKNOWN; the UI never infers gender
from a name. Browser voices are chosen by locale, with a base-language fallback;
browser gender matching is not guaranteed. Automatic ElevenLabs selection prefers
matching accent and profile, then an available voice of that profile. The UI warns
when exact accent metadata is absent. Model switching is server configuration only.

Proactive claims reserve for two minutes without consuming delivery cooldown.
Completed playback acknowledges all alerts covered by that spoken summary with
their reservation tokens. Completion updates cooldown and records VOICE_SPOKEN;
cancelled/generated-only audio does neither. Expired/stale tokens cannot confirm a
new reservation. A failed delivery can be retried after the reservation expires.

## Setup and validation

Backend configuration names: `ELEVENLABS_API_KEY`, `ELEVENLABS_MODEL_ID`,
`ELEVENLABS_ENABLED`. Configure through the existing backend environment loader,
then restart the backend. The model defaults to eleven_multilingual_v2; enablement
defaults to key availability unless explicitly disabled. No frontend key is needed.
Apply database migrations on each deployment before using the new alert delivery
protocol. Migration 010 was applied to the local hse_app database during this task.

`npm run voice:elevenlabs:smoke` in backend is opt-in, speaks a generic short phrase,
does not save audio and is excluded from npm test. It skips when unavailable and
prints only status/model/voice/latency. Default tests mock all provider HTTP calls.

Manual acceptance: select a real available voice, preview female/male and PT-PT/
PT-BR, save, ask about overdue actions, compare full visual with short speech,
replay after changing preferences, interrupt playback, mute and verify no synthesis
request, then verify browser fallback with provider unavailable. Confirm completed
alerts show VOICE_SPOKEN and cancelled previews/alerts do not. Test account change
to ensure no previous voice preference or replay remains. Audio quality needs a
real account and browser listening test; automated playback mocks cannot prove it.

Next increment: structured verified speech projection (instead of Markdown table
recognition), then progressive playback if measured latency warrants it. No Realtime,
ElevenAgents, hands-free, new STT, voice cloning or LangGraph changes are included.

Official references:
- https://elevenlabs.io/docs/api-reference/text-to-speech/stream
- https://elevenlabs.io/docs/api-reference/voices/search
