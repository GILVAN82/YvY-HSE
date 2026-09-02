# Multilingual Voice Architecture

## Purpose

Voice is an input/output interface to the existing YvY HSE agent. It does not create a second agent and cannot bypass Guard, operational Tools, RAG, Memory, Semantic Verification, or Human-in-the-Loop controls.

```text
Explicit microphone action
  -> Browser Speech-to-Text
  -> original transcript + per-turn language metadata
  -> existing POST /api/ai/chat
  -> Guard -> Agent -> Tools/RAG/Memory -> Verification -> HITL
  -> final controlled text
  -> verified-response gate
  -> Browser Text-to-Speech + visible transcript
```

## Speech-to-Text and language resolution

`SpeechRecognitionService` abstracts the browser Web Speech recognition API. It requests microphone permission only after the user selects **Talk to YvY**, stops acquired media tracks immediately after permission validation, does not implement wake-word monitoring, and does not persist raw audio. Unsupported browsers and denied permission fall back to text.

The original transcript is preserved in `VoiceTurnMetadata`. Language is resolved per turn (`detectedLanguage`), independently of the application UI language. An explicit request such as “Explique isso em inglês” sets `requestedResponseLanguage`; this becomes `effectiveResponseLanguage`. The same metadata and transcript are sent additively to the existing chat endpoint. The backend rejects metadata whose transcript differs from the agent message.

## Agent, verification and HITL boundaries

Voice calls `YvyCommandCenterAgentService.send`, exactly like typed input. Existing SSE events drive tools, RAG, trace, verification, and approval state. TTS is invoked only after the request finishes and the recorded verification state is `VERIFIED`, or for the controlled pending-approval message. Critical actions remain pending for an authenticated on-screen approver; voice never invokes an approval endpoint.

Unsupported, contradicted, insufficient-evidence, safety-blocked, failed, or unfinished drafts are never sent to speech synthesis. Written output remains visible for auditability, including sources and detailed metadata; citations are not separately read aloud.

## Text-to-Speech and controls

`SpeechSynthesisService` abstracts browser speech synthesis and chooses a voice matching the effective per-turn language where available. Users can mute, stop, or replay the last verified response. If synthesis or a language voice is unavailable, the written response remains available.

The visual core exposes listening, transcribing, understanding, analysing, speaking, and all pre-existing execution states. A lightweight CSS waveform represents input/output activity and respects reduced-motion preferences. Status changes use an ARIA live region, controls are native keyboard-accessible buttons, and the transcript stays visible.

## Privacy and failure behavior

- No automatic or always-on microphone.
- Browser permission is explicit and recording is visibly indicated.
- Stop/cancel controls are always available during capture.
- No raw audio storage; only transcript and safe metadata are retained in browser state.
- Permission denial, silence, unavailable STT/TTS, cancellation, and network/provider failures preserve text interaction.
- No credentials are placed in Angular; the existing backend remains the only AI-provider boundary.
