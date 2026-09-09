> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Current output uses the ElevenLabs adapter and browser-dependent speech input; older engine descriptions below are historical. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# Human-like Conversational Voice

Sprint 1.4D extends the existing YvY voice interface; it does not introduce another agent. Every voice turn still reaches the same `/api/ai/chat` endpoint and preserves its thread identifier, short-term conversation history, Guard, Tools, RAG, Memory, Semantic Verification, and HITL boundaries.

```text
explicit Talk / barge-in
  -> stop current TTS if speaking
  -> STT + per-turn language
  -> existing thread-aware YvY Agent
  -> Guard -> Tools/RAG/Memory -> Verification -> HITL
  -> controlled display response
  -> deterministic spoken formatter
  -> punctuation-aware TTS chunks
  -> transcript + optional follow-up
```

## Spoken response contract

`SpokenResponseFormatterService` produces `displayResponse` and `spokenResponse`. The display value remains the complete controlled answer. The spoken value removes citation metadata and, for long answers, uses only the first verified clauses plus localized navigation language. It cannot call a model or introduce database facts. Formatting occurs only after the final execution trace is VERIFIED, or after a controlled pending-HITL response.

## Multi-turn and references

Voice and text use `YvyCommandCenterAgentService`, whose thread ID and bounded history already support contextual follow-ups. Language remains per turn. Ambiguous references are therefore resolved by the existing guarded agent, which must ask for clarification when evidence does not identify one object; the voice layer does not guess.

## Interruption and playback

Starting Talk while SPEAKING cancels the active synthesis queue before microphone capture begins. Stop voice cancels playback only; Cancel cancels recognition; neither invokes nor resolves an agent approval. Speech is divided at punctuation, delivered with calm rate and neutral pitch, and guarded by a generation token so obsolete chunks cannot continue after interruption.

## Transcript, privacy and accessibility

The response drawer records the last 20 in-memory voice turns with role, input mode, language, timestamp, verification status, display text, and spoken text. Raw audio is never stored. Native buttons remain keyboard accessible, all speech remains readable, and mute/text alternatives remain available.
