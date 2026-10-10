# MODEL EXECUTION / RETRY INCIDENT

## Root cause

The current configured provider rejects requests with HTTP 429 and `credit_balance_exhausted`. A single minimal smoke request, with SDK retries disabled, confirmed `QUOTA_OR_BILLING_ERROR` in 1841 ms. Credentials were detected and the provider was reachable. The failed request does not establish current model availability beyond the provider accepting and rejecting the request on credit grounds.

The application incorrectly collapsed quota/billing errors into transient `MODEL_RATE_LIMIT`, recoverable=true. Retrying cannot repair exhausted provider credit. No retrieval, corpus, prompt, evidence, HITL routing, provider selection or environment configuration change is appropriate for that condition.

## Correlation and original provider/adapter error

Browser Inspector at localhost:4300/home confirmed run `45ede8e5-2417-475d-9f99-e2521cd78e44`, SEARCH_HSE_KNOWLEDGE, no tools, NOT_USED retrieval and zero evidence.

Structured backend logs in tmp/project-backend.out.log correlate that run to thread `ccb1f583-21f1-4224-83f6-9213909b5cfa`:

- 2026-09-14T13:05:07.777Z: new runner execution.
- 13:05:07.785Z: guard; 13:05:07.788Z: agent.
- 13:05:07.791Z: model_started, openai.responses / gpt-5.5.
- 13:05:16.941Z: provider stage_failed, MODEL_RATE_LIMIT, recoverable=true; provider duration 9150.1 ms.
- 13:05:16.945Z: finalize_failure.

Historical logs did not retain the original provider code or HTTP status. Therefore credit_balance_exhausted is directly confirmed for the current smoke, while historical failures are directly confirmed only as the combined rate-limit/quota classification. The fix adds safe HTTP/category/code projection so this distinction will be available for future incidents. No raw provider payload is logged.

Provider: openai.responses. Model: gpt-5.5. Current safe error fingerprint: APICallError>Object, HTTP 429, credit_balance_exhausted. No timeout/auth/schema/network failure was observed in the smoke. The configured model timeout is 60000 ms.

## Why stepCount was 0

agentNode initializes steps to zero and increments on the SDK finish-step event. The provider failure occurred before a completed step or tool call. The smoke yielded one SDK lifecycle event before the error; a stream object existing does not establish a completed provider response. No fake tool execution or evidence should be produced.

## Why Retry failed

Retry did create a new execution: prior run b7def1ee-f694-44ba-9aa4-47e9601a4f83 and retry 45ede8e5-2417-475d-9f99-e2521cd78e44 share the owned thread but have distinct model_started events. Both hit the provider failure classification. This is not a cached terminal result or a discarded new demo token. Existing restart generation protections remain intact.

## Fix

- Distinguish MODEL_QUOTA_EXHAUSTED, recoverable=false, from transient MODEL_RATE_LIMIT, recoverable=true.
- Present a localized message requiring provider credits to be restored before retry, while preserving compatible wire error aliases.
- Include sanitized status/category and allowlisted provider codes in correlated provider failure logs.
- Test quota wrappers, safe messages/logs, zero steps, fresh runId after recoverable failure, repeated failure followed by success, and Demo Retry success without HITL resolution.
- No automatic retry loop or automatic approval was added. Manual Retry remains available after an external condition is corrected.

## Voice status root cause

The actual browser header reads Unavailable, not Voice Unavailable. The header template derives this directly from agent.error(), independently of VoiceEngineService. It indicates the model execution error and does not establish a TTS outage. Inspector ELEVENLABS describes the recorded effective playback engine, not global provider health. No evidence tied this incident to an ElevenLabs failure; voice behavior was left unchanged.

## Validation

- Agent: 44/44, supplementary 3/3.
- Intent: 134/134.
- Retrieval: baseline preserved; RRF required-source recall 1, relevant recall 1, MRR 1, top-1 source accuracy 1, irrelevant retrieval rate 1/6.
- HITL, Demo Restart/Skip and Evidence View: existing regression suites passed; implementations unchanged.
- Backend: 418/418.
- Frontend: 218/218.
- Hermetic harness: 6/6; offline agent and retrieval evaluation also ran without network.
- Backend and frontend typechecks and builds passed. Existing frontend budget warnings remain.
- Evaluation ran from a temporary source copy to preserve the already-modified offline-latest artifact.

## Manual browser validation after credit restoration

On 2026-09-14 the user confirmed provider credits were restored. No provider, model, prompt or environment configuration was changed.

- Clicked Retry on the existing failed Step 3 (old run 45ede8e5-2417-475d-9f99-e2521cd78e44, previously recorded recoverable=true). New run 559ca8b9-ccb4-4faf-b12e-f8fdd261d375 used the same thread ccb1f583-21f1-4224-83f6-9213909b5cfa. Inspector showed SEARCH_HSE_KNOWLEDGE, search_hse_knowledge, HYBRID, two evidence items, OSHA reference and VERIFIED. The demo step completed, the header returned Online, and prior failed conversation entries remained visible. Runner duration was 7389 ms. This was recovery from the actual observed failure, not an injected fake response.
- Muted voice, clicked Restart, confirmed Step 1 / Introduction / 00:00, then continued to Operational Overview. New run 1085569f-befb-4f5b-ab91-bc59aaca996c selected list_actions, list_incidents and get_kpi, with three evidence items and VERIFIED. The UI displayed four pending actions, zero open incidents and safety performance. Voice was muted and the text workflow completed. Restored the original unmuted preference afterward.
- No approval decision, write, corpus change or full live evaluation was performed. The presentation was left at Step 2; later steps were not started.

The actual failed execution had been marked recoverable by the previous implementation. Exhausted credits are now correctly classified as requiring external remediation; transient recoverable failures and repeated failures are additionally covered by hermetic tests. No additional provider outage was artificially introduced.

Commit scope: quota classification, localized safe failure message, safe correlated diagnostics, regression tests and this report. All required validation gates now pass; unrelated local changes are excluded.
