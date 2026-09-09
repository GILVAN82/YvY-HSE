# Sprint G — Prompt architecture and observability

Baseline: `8b0e987` (F.2), following D `1d93165`, E/E.1 `79f3f41`, F `14e3c47`, F.1 `46971f1`.
Scope is prompt architecture, provider contracts and technical diagnostics. No approved corpus,
retrieval policy, threshold, model selection, `.env`, authorization policy or HITL policy changed.
Inspector additions reuse its existing layout. The ordinary Command Center is not redesigned.

## Audit and prompt inventory

The initial working tree and binary diff were backed up before implementation. Before G,
`agent.node.ts` interpolated memory, attachment text and the user-derived normalized query
into `system`, despite textual labels calling them untrusted. The same block repeated
operational overview instructions already present in `SYSTEM_PROMPT`. Provider failures were
largely reduced to `AI_MODEL_ERROR`/`AI_TIMEOUT`; graph failures also used the model alias.

| Name | File / caller | Purpose and content | Runtime data and role boundary | Structured output | Identity / status |
|---|---|---|---|---|---|
| SYSTEM_PROMPT (before) | `ai/prompt.ts`; graph agent and legacy runner | Monolithic persona, tool, evidence, memory, language and HITL rules | Dynamic graph interpolation included untrusted text in system | Natural final answer | No explicit version; **DEPRECATED**, migrated into modules |
| Public prompt entry point | `ai/prompt.ts`; graph/legacy/provenance | Exports composer and registry; no unused prompt constant | No runtime content stored in this file | Typed composition result | **ACTIVE**, `agent-g-v1` |
| Core policy | `ai/prompts/policies.ts`; composer | Role, scope, tolerant interpretation | Trusted source-controlled system policy | Natural answer | **ACTIVE**, agent fingerprint |
| Safety policy | Same | Privacy, instruction/data boundary, secret protection | System policy; names/history/documents cannot introduce instructions | Deterministic guards remain authoritative | **ACTIVE** |
| Tool policy | Same | Routing conventions, exact live-data use, available capabilities | Conditional tool references; actual active registry is authoritative | Existing SDK/Zod tool input schemas | **ACTIVE** |
| Evidence policy | Same | Approved summaries, exact citations, abstention and jurisdiction | Retrieved chunks remain tool-result data | Existing typed evidence and verification contracts | **ACTIVE** |
| HITL policy | Same | Consultative behavior and prohibition on autonomous LOTO approval | Original human gate retained; local draft rules preserved only in integrated profile | Existing approval contracts | **ACTIVE** |
| Language / personalization | Policies plus `prompts/composer.ts`; `responseLanguage.ts`, `personalization.ts` | User language and restrained greeting | Validated language/first-turn flag in system; authenticated name/greeting are JSON data in a user context message | Runtime policy schema | **ACTIVE** |
| Response policy | Policies / composer | Concise workplace wording, attention first, no repeated greeting | System behavior; no raw request interpolation | Natural text, subsequently verified | **ACTIVE** |
| Intent context | Composer; deterministic `intentRouter.ts` decision supplied by runner | Scope, intent, candidate tools and normalized query | Routing facts are metadata, not evidence; user-derived normalized query stays in the lower-priority data message | Existing deterministic typed decision; no classification LLM | **ACTIVE**, router source fingerprint retained |
| Long-term memory | Composer; runner retrieves `MemoryService` results | Relevant stored context | JSON user context, explicitly untrusted; never system policy | Existing memory schemas / write-intent gates | **ACTIVE** |
| Attachments | Composer and agent image/file parts; attachment service | Temporary document/spreadsheet text and image bytes | User data message/file parts; original provenance retained; no memory persistence | Existing attachment validation | **ACTIVE** |
| RAG/query preparation | `rag/queryPlan.ts`, `technicalGlossary.ts`; retrieval service | Original semantic query and controlled lexical keywords | Deterministic input data; no query-planning model prompt | Existing F.2 Zod query plan | **ACTIVE**, `controlled-hse-pt-en-v1`; explicitly NOT an LLM prompt |
| Verification | `semanticVerifier.ts`, `verify.node.ts`; graph | Facts, citations, safety and jurisdiction checks | Deterministic code, not model policy generation | Existing typed `VerificationResult` | **ACTIVE**, `semantic-verifier-e1`; verification source fingerprint also retained |
| Refusal/finalization templates | `refuse.node.ts`, `finalize.node.ts` | Safe localized user messages | Output templates, not instructions sent to another model | Existing response/status contracts | **ACTIVE**, not prompt versions |
| Voice | `responseLanguage.ts`, `voice/elevenlabs.ts`, frontend spoken-summary policy | Transcription language metadata and TTS synthesis | No separate voice LLM prompt found; synthesis text is provider input data | Zod voice inputs and new provider JSON validation | **ACTIVE**, independent voice request diagnostics |
| Legacy loop | `legacyRunner.ts`; configured HTTP dispatcher | Pre-LangGraph comparison path | Now shares role-separated composer and validated model stream | Same registered tool schemas | **LEGACY_REQUIRED**, not the primary Capstone architecture |

No separate LLM verification/classification/query-rewrite prompt or unused JSON response-format
configuration was found in these runtime paths. Their deterministic implementations are kept;
adding another model call merely to produce JSON would add a new failure surface.

## Trust boundaries and composition

**TRUSTED_POLICY:** reviewed `corePolicy`, `safetyPolicy`, `toolPolicy`, `evidencePolicy`,
`hitlPolicy`, `languagePolicy`, `memoryPolicy`, `responsePolicy`. The composer assembles each
once; redundant capability/attachment instructions and the duplicated dynamic overview rule
were consolidated. `prompt.ts` remains an active public entry point, not a dead compatibility blob.

**TRUSTED_RUNTIME_CONTEXT:** the server resolves language, first-interaction status, identity
provenance and deterministic routing. `RuntimePolicySchema` validates system-bound language,
boolean and active tool names. Authenticated IDs, permissions and project scopes remain enforced
by server authorization and scoped tools; model interpretation is never a permission check.

**UNTRUSTED_USER_CONTEXT:** requests, history, names as free text, normalized query text, memory,
attachments and retrieved content. Authentication establishes the provenance of a name, but
does not make its characters safe instructions. Name/greeting and routing data are serialized
into a distinct user context message alongside explicitly untrusted memory/attachments. The
latest actual request remains last, including image/file parts. Tool results retain their SDK
tool role. No delimiter is relied on to give these values system authority.

The active tool list comes from the actual per-turn execution registry. Policy examples are
conditional on tool availability. Unknown tools and malformed arguments are rejected before
execution. This supports capability honesty; it does not claim that a language model can never
utter an unsupported capability. Deterministic verification and scoped tools remain necessary.

This use of message roles follows the instruction/data distinction in the
[official OpenAI prompt engineering guide](https://developers.openai.com/api/docs/guides/prompt-engineering).
Implementation was checked against the installed AI SDK declarations; no SDK/model upgrade or
API generation request was required for this sprint.

## Versioning and structured outputs

`PROMPT_REGISTRY.agent` carries `agent-g-v1` and a SHA-256 fingerprint of policy modules and
the composition contract version. Runtime user data is excluded from the fingerprint and
from logs. The identity appears in evaluation provenance, correlated events and Inspector.
Query-plan and verification registry entries explicitly identify deterministic contracts,
not fictitious model prompts; existing source/config fingerprints remain available.

Integrated and isolated policy fingerprints intentionally differ: the integrated workspace
retains the preexisting draft/app-data rules while the commit excludes that unfinished feature.
The same architecture/version with different content fingerprints makes this difference visible.

Structured outputs remain focused on boundaries where they matter: tool inputs, retrieval
plans, evidence, verification/approval decisions, runtime policy fields and voice provider JSON.
Final conversational answers remain natural text and undergo existing verification before
streaming from the primary graph. G does not force arbitrary prose into JSON.

## Provider validation and error taxonomy

`modelStream.ts` owns SDK stream consumption and application validation; graph nodes consume
validated parts. The SDK validates provider wire/tool schemas. G additionally checks text
types, tool name/ID/argument shape, active registry membership, completion presence, finish
states and empty output. Invalid tool inputs cannot execute. Known SDK response/schema errors
are classified even when nested inside retry causes. Optional valid provider token usage is
retained; missing/malformed optional usage is `NOT_AVAILABLE`. Cost is always `NOT_AVAILABLE`.

| Model category | Meaning |
|---|---|
| MODEL_EMPTY_RESPONSE | No usable text/tool output or empty provider response |
| MODEL_INVALID_RESPONSE | Missing/malformed required response data or unexpected termination |
| MODEL_SCHEMA_ERROR | Invalid structured/tool input or unknown tool |
| MODEL_TIMEOUT | Provider timeout/aborted stream |
| MODEL_RATE_LIMIT | Rate limit or quota/billing rejection |
| MODEL_AUTH_ERROR | Provider authentication failure |
| MODEL_PROVIDER_UNAVAILABLE | Provider/network availability failure |

Domain categories are **AUTHENTICATION, AUTHORIZATION, VALIDATION, MODEL, RETRIEVAL, TOOL,
DATABASE, HITL, VOICE, INTERNAL**. Provider authentication belongs to MODEL with its specific
code; an unauthenticated application request is a distinct authentication concern.

Classification happens near the provider stream, tool body, retrieval service or approval/voice
boundary. First observed failure is preserved in the run observation so an outer generic wrapper
cannot erase a more specific cause. Programming `TypeError`/`ReferenceError` stays INTERNAL;
it does not become no-evidence. Retrieval infrastructure degradation/abstention rules are unchanged.

Existing SSE `errorCode` aliases such as `AI_MODEL_ERROR`, `AI_TIMEOUT`, `AI_EMPTY_ANSWER` and
`AI_TOOL_FAILURE` remain for compatibility. Specific category/code/recoverability are retained
in `executionTrace.observability.error` and logs. This is a deliberate additive contract, not
a claim that every historical endpoint has migrated to new wire codes.

Voice catalog/add responses now reject missing/wrong required fields and malformed JSON as
`INVALID_RESPONSE`, rather than treating missing data as an empty catalog or a network error.
Audio checks, cancellation and browser fallback policy remain unchanged. No spoken text,
voice key, request body or provider response body is logged.

## Correlated observability and Inspector

`observability/context.ts` uses `AsyncLocalStorage.run` with immutable per-execution metadata
and a bounded per-run observation accumulator. There is no mutable global current-run object.
Runner, graph nodes, registered tool executions, retrieval, verification, model stream and HITL
share run/thread identity. Concurrent-run tests demonstrate isolation.

Events project a fixed safe field set: timestamp, level, event, runId, threadId, hashed/opaque
owner, stage, provider/model, tool, duration, prompt version/fingerprint, error category/code and
recoverability. Arbitrary object fields and raw errors are not serialized. The logger does not
accept prompts, API keys, cookies, attachments, private memory or operational result bodies.
Existing HTTP access-denial logs still use their request identity before an agent run exists.

Durations cover runner total, provider stream, graph nodes (including verification), tool
execution and retrieval. Stages are nested and must not be summed as independent wall time.
Provider stream duration includes SDK-managed tool steps; individual tool durations explain
that overlap. It is not a measurement of model-only compute time.

Voice HTTP requests receive their own server-generated execution identity and correlated
provider/fallback events. They are independent requests, not falsely attributed to a preceding
chat run; no new client-controlled run/thread identity was introduced.

Inspector shows prompt identity, provider/model, stage timings, reported usage or NOT_AVAILABLE,
cost availability and specific failure/recoverability, alongside its existing route, tools,
RAG mode, verification, run/thread and HITL details. Input/normalized query/name and textual tool
arguments are removed from the technical snapshot; bounded non-sensitive count summaries remain.
The frontend stores an explicit Inspector projection, excluding full draft/request payloads.
These details were not added to normal chat messages.

## Legacy/dead configuration decisions

- **ACTIVE:** LangGraph default, tool registry, response-language resolver, guard/verification,
  provider allowlists, memory/attachment contracts, query schemas and approval policies.
- **LEGACY_REQUIRED:** `AI_ORCHESTRATOR=legacy`, its dispatcher and loop tests. Kept for existing
  comparison/configuration dependencies; it does not represent graph verification/HITL parity.
- **DEPRECATED/MIGRATED:** monolithic `SYSTEM_PROMPT` constant replaced by active public composer
  exports and modules. No caller retains the old constant. Obsolete verification/authentication
  comments were corrected.
- **DEAD/REMOVED:** unused `REFUSAL_MESSAGES` table in `legacyRunner.ts`; actual refusal messages
  already came from `controlledRefusalMessage`.
- **LEGACY_REQUIRED CONFIG NAME:** `ALLOW_UNAUTHENTICATED_WRITES` is still read by `index.ts` and
  tested. Its historical name is not authorization; it was not removed or changed in `.env`.
- **MODEL NAMING:** existing provider/model IDs are active allowlisted configuration, not an
  availability guarantee. No alias migration was justified or performed. Account availability,
  billing, provider retirement and live generated-answer quality were not tested here.

The legacy loop test previously invoked an unregistered tool and relied on the permissive SDK
behavior. It now registers its hermetic tool before testing loop closure. Both mock model
implementations declared v3 but returned v2-shaped `finishReason` and token usage; those fixtures
now use the installed v3 contract. Expected safety, agent and intent labels were not weakened.

## Regression and reproducibility

Final gates: integrated backend **389/389**, isolated backend **371/371**; integrated frontend
**118/118**, isolated frontend **112/112**. Agent **44/44**, supplementary **3/3**, intent
**134/134** in integrated, isolated and fresh backend patch replay. Typechecks and builds pass
for backend and frontend (app/spec). Existing Angular budget warnings remain non-blocking.

F.2 real retrieval baseline was rerun with the same **24 cases (EN16/PT8)**, approved corpus,
query/document vectors and threshold **0.45**. Hybrid required/relevant recall **100%**, irrelevant
rate **0%**, MRR/top-1 **1.0**; semantic required/relevant recall **66.67%**, irrelevant **0%**,
MRR/top-1 **0.63636**. Per-language results and source rankings are unchanged. No new corpus
ingestion, query embeddings, paid generation or threshold calibration occurred.

See [comparison and gate evidence](../../artifacts/evaluation/sprint-g/comparison.json) and
[preservation audit](../../artifacts/evaluation/sprint-g/preservation.json). All 55 preexisting
entries remain preserved: unchanged files are byte-identical, overlapping shared refactors
retain the exact local delta, and local prompt additions moved into policy modules.

The authoritative offline artifact points to a SHA-256-checked backend patch over `8b0e987`.
A fresh checkout applied that patch and reproduced its source/prompt fingerprint, agent/intent
gates and real retrieval metrics. Frontend changes are tested separately in integrated and
isolated candidates. The patch is the backend evaluation reproduction, not a UI patch.

Re-run from `backend` with locked dependencies and the existing approved PostgreSQL corpus:

```powershell
npm.cmd run eval:offline
node --require ts-node/register/transpile-only src/ai/rag/multilingual.cli.ts --run-dir ../artifacts/evaluation/f2-multilingual --profile after-g-new-replay
```

The agent suite blocks sockets/fetch. Retrieval uses read-only PostgreSQL and retained real
vectors with HTTP blocked. A unique profile name avoids overwriting prior measurements.

## Review dashboard

| Perspective | Newly evidenced in G | Limit / ownership |
|---|---|---|
| Turing — prompt engineering, application design, privacy, evaluation, docs | Modular roles, data boundaries, correlated diagnostics, same-baseline gates | No live answer-quality claim; technical diagnostics stay in Inspector |
| Jochen — readiness/explainability | Inspectable prompt identity, route and stage/failure metadata | Demo Mode intentionally not started |
| Stefano — roles, structured outputs, dead config, model naming, safeguards | User-role memory/attachments, explicit schemas, unused table removed, legacy audited | Model list availability is not asserted |
| Vytautas — reformulation, narrow errors, provenance | F.2 plan/config preserved; prompt/source fingerprints and replay | Existing 24-case benchmark remains small and targeted |
| Erikas — configuration, outputs, exceptions, modularization, APIs | Versioned registry, SDK-compatible stream validation, domain errors | No forced prose JSON or SDK migration |
| Andrius — roles, structure, logging, failures, ownership | Composer owns prompts, adapter owns response validation, context owns safe logging, graph owns orchestration | Historical SSE aliases retained explicitly |
| Justinas — validation, near-source errors, resilience | Required response/tool/voice fields, separate timeout/rate/auth/schema errors, fail-closed unknown tools | Injected provider failures, not live outage experiments |
| Fatima — contracts, responsibility, layered validation | Typed runtime policy, usage/diagnostics, SDK schemas plus existing verifier/HITL | Prompt boundaries complement deterministic controls; they are not a proof of model obedience |

These are evidence mappings, not claims of external reviewer approval.

## Newly validated and remaining limits

New tests cover role placement, module uniqueness/versioning, original language/HITL policies,
concurrent correlation, provider timeout/rate/auth/unavailable/empty/invalid/schema responses,
tool non-execution on invalid inputs, retrieved-document tool injection, memory/attachment
boundaries, retrieval/database/auth categories, HITL pending, voice fallback and log/snapshot
privacy. Thirteen tests were added across backend prompt/observability and voice coverage,
plus one frontend snapshot test. Existing assertions were adapted to structural roles rather
than giant prompt snapshots.

Still not claimed: resistance to every adversarial model output, exhaustive provider-failure
coverage, live provider availability, cost estimates, production APM latency, additional corpus
coverage, or legacy parity with LangGraph verification. Tests use scripted models and injected
failures. The actual authorization, tool registry, verification and HITL remain the security
boundaries. No next sprint or Demo Mode was started.

## Defence notes

**Why separate system and user content?** Policies define behavior; requests and documents are
data. Separate roles avoid promoting free text to system authority merely because the server
retrieved it. Deterministic authorization/verification still enforce the sensitive decisions.

**Why is long-term memory untrusted?** It can preserve user-originated or malicious text across
sessions. Persistence does not make it policy or permission to invoke a tool.

**Why not force every response into JSON?** Schemas protect machine-consumed plans, tool inputs
and decisions. Natural final answers are useful to people and already pass evidence verification.

**How are prompt versions tracked?** An explicit registry version and policy/composition
fingerprint travel through provenance, logs and Inspector independently of the Git commit.

**How do you diagnose a failed run?** Correlate run/thread IDs, inspect stage timings and the
first specific category/code/recoverability, then compare prompt/model and retrieval identities.

**How do you avoid logging sensitive HSE data?** Log a fixed metadata projection and hashed
owner, never full prompts, documents, memory, request bodies, tool result bodies or raw errors.

**Why keep/remove the legacy path?** Its configured comparison path still has callers/tests,
so it remains explicitly labeled. Dead refusal configuration was removed; the primary reviewed
architecture remains LangGraph with deterministic verification and human approval.
