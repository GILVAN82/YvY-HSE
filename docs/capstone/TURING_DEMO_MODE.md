# Final Turing Demo baseline

2026-09-14; runtime `f9b58d0`. [Canonical final evidence](FINAL_SUBMISSION_BASELINE.md).

The six implemented steps remain Introduction, Tool Calling, RAG + Citation, Memory, Human Approval and Closing.
The current two-sentence RAG question and citation placement are submitted; retrieval/corpus are unchanged.
Current PENDING requires a correlated manual human decision; historical APPROVED/REJECTED cannot satisfy a new session.
Restart resets local step/timer/generation and preserves persistent approval; Skip retains PENDING.
Finish presentation reaches COMPLETED, freezes the timer and shows truthful step outcomes. Voice failure leaves text usable.
Feature flags and safe context remain required. Final smoke opens preflight only; a timed continuous rehearsal remains a separate user action.
Prior browser acceptance: [HITL](../turing-live-human-decision-validation.md), [navigation](../demo-navigation-hitl-validation.md), [terminal](../turing-terminal-state-validation.md).

## Historical sprint reference

The remainder preserves earlier source evidence. Its counts, local-feature labels and readiness states are superseded by the final baseline above.

# SPRINT I - TURING DEMO MODE

Presentation implementation on branch `capstone/yvy-hse`, based on Sprint H `4e8f52b`. The commit containing this document is the Sprint I baseline; resolve it with `git log -1 --format=%H -- docs/capstone/TURING_DEMO_MODE.md`.

## Purpose and architecture

The Demo Orchestrator controls presentation order, not reasoning. It reuses `YvyCommandCenterAgentService.send`, the authenticated `/api/ai/chat` route, the unchanged primary LangGraph, real tools/retrieval/memory/verification/HITL and normal SSE finalization. Institutional introduction/closing text is explicitly narration; it is not a tool result or verified operational claim.

```text
Server feature flag and read-only preflight
  -> frontend presentation state machine
  -> existing agent service -> authenticated chat -> unchanged LangGraph
  -> tools / RAG / memory -> verification -> digital HITL when required -> SSE
  -> normal Command Center timeline -> existing spoken formatter / VoiceEngine
```

`TuringDemoService` is not another agent or LangGraph. It does not manufacture tool output, citations, verification or approvals. A boolean transport success is insufficient: a new actual execution snapshot must satisfy the step's checks. A valid degraded retrieval is labelled as a warning if HYBRID was not observed.

## Enable and disable

Disabled by default. The backend reads process-level configuration; no `.env` was edited. For a separately prepared synthetic instance:

```powershell
$env:TURING_DEMO_MODE='true'
$env:TURING_DEMO_SAFE_DATA='true'
$env:TURING_DEMO_PROJECT='<exact-authorized-project-code>'
# Start the backend using the existing dedicated hse_app_demo database configuration.
# Declare safe data only AFTER reviewing all data accessible to the presentation account.
npm.cmd run demo:start
```

`demo:start` has its existing database preflight; it does not replace operator review of synthetic data, account permissions and provider processing. Do not seed/reset a database merely to make this feature appear ready. HSE records, long-term preferences and account identity must all be suitable for projection/provider use.

The dedicated database must be exactly `hse_app_demo`; the current project must exist and be authorized. `TURING_DEMO_SAFE_DATA=true` is an operator declaration, not an automatic privacy certification. Operational overview may query the account's entire allowed scope, so every accessible record must be safe, not just one project. The same safe-context restriction applies to RAG because normal agent memory is part of its request context.

Disable by setting `TURING_DEMO_MODE=false` (or removing the variable) and restarting that backend process. The button is absent and the demo preflight route returns disabled. No presentation conversation, timer or approval marker is created while disabled. No new external analytics are used. Runtime class initialization is not a persisted demo session.

## Entry point and preflight

A discreet **Turing Demo** button appears in the Command Center header only when authenticated server configuration enables it. Opening the controller does not call the model. It checks the read-only `/api/ai/turing-demo/preflight` route:

| Check | Meaning / boundary |
|---|---|
| Authenticated | Existing middleware/principal and AI_USE permission; no new authorization policy. |
| Agent | Configured available provider and primary LangGraph selection; not a live provider-quality/uptime guarantee. |
| APIs/routes | Demo route is mounted alongside existing authenticated chat; later calls still surface their real HTTP failures. |
| Voice | Server configuration plus actual client playback/fallback state; a key is not proof playback will succeed. |
| RAG | Indexed document/chunk presence. Actual retrieval/citation/verification must succeed during the step. |
| Safe operational context | Explicit safe-data declaration, dedicated database, existing authorized project. No customer records are sampled to prove this. |
| Inspector | Existing Inspector component/service is available. Only actual snapshots are displayed. |

Results: READY, READY_WITH_WARNINGS or BLOCKED. Missing safe data displays **Demo operational data unavailable**. The presenter may demonstrate narration and skip dependent steps; a skip is never shown as successful evidence. Authentication, required agent configuration or failed infrastructure preflight blocks start.

## Six steps

| Step | Real behavior | Expected evidence/state | Target | Turing / reviewer mapping |
|---|---|---|---|---|
| Introduction | Deterministic institutional text by YvY; created by Gilvan Amorim, no inflated biography. | Narration only; no artificial run/tool/evidence metadata. | 30-45 s | Purpose; Jochen focused story. |
| Tool Calling | `Show the current operational overview.` through the existing service. | Actual OPERATIONAL_OVERVIEW, completed tools and VERIFIED/PARTIALLY_VERIFIED evidence. Empty results remain truthful. | 60 s | Tools/function calling; Jochen. |
| RAG + Citation | `What does the approved LOTO guidance require?` through the same service. | Actual knowledge tool, citations, retrieved chunks and VERIFIED result. Degraded/non-observed hybrid mode is a warning, not hardcoded HYBRID. | 60 s | Grounding; Vytautas; structured boundaries for Stefano. |
| Memory | `Show open actions.` then `Show evidence.` in the same thread. | Router resolves the evidence follow-up from prior context; actual action tool and active thread state. | 45-60 s | Advanced execution; Jochen memory. |
| Human Approval | Exact authorized project in `Approve LOTO <project> as safe for execution.` | Actual persisted PENDING card, or truthful refusal/failure. The demo stops for manual Approve/Reject. | 60 s plus human wait | HITL and ethics; Jochen; Fatima ownership. |
| Closing | Deterministic capability/limit statement. | No assertion that skipped/failed steps succeeded. No physical execution or accident-prevention guarantee. | 20-40 s | Ethics/impact and evaluation boundary. |

Memory intentionally uses the already supported evidence follow-up; no router changes or implicit durable memory writes were introduced. The short explanation of explicit long-term memory is narration, not a claim that something was saved.

## State machine and controls

IDLE -> PREFLIGHT -> INTRODUCTION -> TOOL_CALLING -> RAG -> MEMORY -> HITL -> WAITING_FOR_HUMAN -> CLOSING -> COMPLETED, with PAUSED and FAILED_STEP branches. Each next step requires Continue. Progress is at most six items. Pause stops speech and prevents the next memory turn; an in-flight response can finish but cannot silently start another turn while paused. A bounded step deadline remains a safety timeout even during a long pause.

Retry repeats read-only steps via the real agent, but HITL retries first consult persisted server state and never blindly resend a critical request. Skip records SKIPPED, preserves any pending decision and moves on explicitly. Continue from a failed step advances without relabelling it completed. Restart clears progress, not memory or operational records.

A request-generation/owner fence ignores late presentation responses after exit, timeout, skip or identity change. Exit aborts presentation transport, stops voice/timers, removes the presentation filter and restores the prior same-user conversation. Cross-user exit does not restore the previous user's text. Prior local record-draft work remains outside the Sprint I commit and is not submitted by the demo.

## Human approval and duplicate prevention

The normal authenticated approval handler is the only writer. No timer, step-completion callback, voice command or Continue button invokes approval. The normal HITL card and demo manual buttons use the existing handler; the sequence observes the returned persisted status. Permission denial never implies approval.

Before dispatch, a per-user sessionStorage marker records the presentation thread. Restart/exit/re-entry consult existing owner/project-scoped approval state. An unresolved marker blocks redispatch even if the HTTP response was lost; the presenter must inspect the existing outcome. Markers deliberately survive Exit so it cannot duplicate writes. No marker is created before an enabled HITL step is actually dispatched. Storage failure prevents dispatch.

This is presentation-level duplicate prevention, not a new database idempotency guarantee across concurrent tabs, cleared browser storage or deployments. Existing ownership/authorization remains authoritative. Do not clear markers to work around an unresolved request. Inspect the pending decision under the same authorized account; no automatic deletion/approval is performed. Equipment linkage and transactional hardening remain prior documented limitations.

## Voice and workspace

Screen = detail; voice = summary. Introduction/closing and bounded safety narration use the existing VoiceEngine, which prefers configured ElevenLabs and keeps its normal browser fallback. Agent responses use the existing SpokenResponseFormatter followed by demo-only identifier/link/citation removal. Full tables, record IDs and Inspector logs are not narrated. Muting/stopping remains available; degraded/unavailable voice leaves text and Continue usable.

A demo-scoped workspace class keeps the core compact at the side and expands the normal timeline; smaller screens prioritize the conversation. Existing near-bottom autoscroll behavior is reused; manually scrolling up does not force a jump. The composer remains on screen, while normal typed/voice submission is held during presentation sequencing; Exit restores normal use. Proactive voice does not interrupt the demo.

The elapsed clock measures local wall time including pauses/human waiting. It creates no external analytics and records no HSE text in analytics. Step outcomes stay in memory until exit. The old conversation is restored rather than automatically deleted.

## Inspector and presenter cues

**Show technical evidence** opens the existing Inspector with a compact presentation filter, not a second Inspector. At most eight fields: runId, intent, route, tools, retrieval/evidence, verification, HITL and prompt version. No token/cost panels, raw prompts, identity, approval IDs or full logs are projected. Source citation labels come from actual snapshots. A reused server approval can be shown without inventing a missing execution trace. Full Inspector is an explicit user action; close it before returning to the public narrative.

Presenter notes are collapsed, never spoken and explicitly labelled **screen-visible**. They are not a private second-display channel; open only when appropriate. Gilvan owns the explanation of State Graph versus ReAct/Plan-and-Execute, deterministic authority, hybrid/RRF/abstention, short/long memory, human safety authority and evaluation limits. No reviewer names appear in the public step narrative.

## Failure behavior

Missing safe context or corpus, unavailable provider, invalid/no snapshot, absent citations, non-verified evidence, timeout and failed human resolution remain visible. The controller offers Retry/Skip/Continue where applicable. A critical unknown outcome is not retried as a fresh write. No fallback produces a fake answer, fake source, fake verification badge, fake navigation or fake approval.

## Manual acceptance and rehearsal

The existing browser showed the entry hidden on the normal `localhost:4200` instance and visible on an isolated acceptance frontend (`localhost:4300`) using a separate backend (`3301`). Only its API origin was changed in the temporary static server; the flag still came from the real authenticated backend. No `.env` or production frontend source was changed for this check.

Read-only environment inspection found current database `hse_app`, demo flag false, safe-data declaration false, and an existing dedicated `hse_app_demo` database. That is not sufficient to declare its contents safe. The acceptance backend intentionally kept the safe-data declaration false.

| Acceptance item | Result | Evidence / remaining |
|---|---|---|
| Disabled entry | PASS | Browser accessibility tree: normal header has no demo button. |
| Enabled entry | PASS | Browser accessibility tree: separate header contains Turing Demo. |
| Introduction | SKIPPED | Full interactive acceptance not completed. Automated narration/state tests pass. |
| Tool Calling | SKIPPED | Demo-safe operational scope not declared for the running acceptance instance. |
| RAG | SKIPPED | Safe presentation account/context and full live flow still need rehearsal. |
| Memory | SKIPPED | Same-thread real two-turn presentation awaits safe-context rehearsal. |
| HITL | SKIPPED | No human decision was automated. Gilvan must manually approve/reject a safe rehearsal request. |
| Closing | SKIPPED | Full interactive acceptance not completed. Automated narration/state tests pass. |
| Voice playback | WARNING | Existing pipeline tested automatically; no full live playback acceptance claim. |

Total manual six-step duration: **NOT MEASURED**. Desktop UI control reported an app-approval timeout; direct browser navigation to the acceptance preflight endpoint was blocked by the browser client. No browser barrier was bypassed. These observations are not a full manual acceptance pass.

Before rehearsal: prepare/verify the dedicated synthetic database and authorized account, confirm safe preferences/records, enable the server flags, choose a real allowed project, verify provider/voice and corpus, then run Start -> intro -> tools -> RAG -> memory -> pending HITL -> Gilvan's manual decision -> closing. Record PASS/FAIL/SKIPPED/WARNING and actual duration. Rehearse failures and Exit/Restart too. Do not label the presentation ready based only on automated tests.

## Regression evidence

[Final gate summary](../../artifacts/evaluation/sprint-i/summary.json): isolated backend **380/380**, frontend **144/144**; integrated backend **398/398**, frontend **150/150**. All backend/frontend typechecks and builds passed (existing non-blocking Angular budgets). Agent **44/44**, supplementary **3/3**, intent **134/134**, hermetic PASS. The 24-query retrieval baseline (EN16/PT8) exactly matches H configuration and metrics: hybrid required/relevant recall 1.0, irrelevant rate 0, MRR/top-1 1.0; semantic-only recall 0.666667, MRR/top-1 0.636364. These are bounded results, not live answer-quality measurements. A fresh backend patch replay reproduced source identity and agent/intent results. The primary graph, RAG, authorization, corpus and `.env` are unchanged. Tests use explicit fixtures only inside test files; production UI never substitutes them for real execution.

## Turing and reviewer dashboard

| Area | Status | Remaining |
|---|---|---|
| Interactive prototype / focused demo | IMPLEMENTED | Full safe-data manual acceptance and rehearsal. |
| Agent design | IMPLEMENTED, primary design unchanged | Presenter must defend WHY and trade-offs. |
| Tool integration | IMPLEMENTED through existing service | Live safe-scope demo acceptance. |
| Advanced execution / memory / HITL | IMPLEMENTED with manual gate | Real same-thread and human-resolution rehearsal. |
| Evaluation explanation | IMPLEMENTED in cues and docs | Gilvan explains bounded 44/44 and 24-query results. |
| Ethics / human oversight | IMPLEMENTED; no auto approval | Existing privacy/equipment/concurrency limitations remain. |
| Presentation readiness | REMAINING | Manual six-step acceptance and timed rehearsal. |
| Jochen: tools, RAG, memory, HITL, focused demo | IMPLEMENTED sequence; REMAINING acceptance | Do not treat fixtures as a demonstration. |
| Andrius: code ownership | REMAINING presenter responsibility | Review code map, WHY, alternatives and failures. |
| Showcase and README URL | MISSING / USER ACTION REQUIRED | No URL created or invented. |

Other real remaining items are retained in Sprint H: limited live-provider quality evidence, larger independent retrieval/generation evaluation, equipment binding, transactional moves, load/outage/security review, free-text/retention/provider governance, normalized contractor scope, deployment audit/backups, original rubric/feedback wording if supplied, and separately reviewed local features. Company tenancy, legal certification and physical execution remain outside the claimed Capstone scope.

## Defence note

**WHAT:** A presentation orchestrator sequences demonstrations; it is not another AI agent.

**WHY:** A deterministic sequence keeps the presentation focused and lets the human pause or explain a real failure.

**HOW:** Every factual step calls the existing authenticated agent service; only actual SSE snapshots, evidence and persisted human decisions qualify for completion. Institutional narration is explicitly separate.

**ALTERNATIVES:** Manual-only presentation offers flexibility; autonomous LLM presentation adds unpredictable ordering; recorded video removes live dependency but cannot claim a fresh execution.

**TRADE-OFFS:** Predictability and explicit controls reduce spontaneity. Real providers/data can still fail. Session-level duplicate prevention deliberately blocks uncertain approval retries.

**FAILURE MODES:** Provider outage, voice fallback, missing safe data/corpus, unverified response, pending or inaccessible HITL state and late responses. Each has a visible bounded outcome; none is replaced by fake success.

**HSE VALUE:** Shows bounded assistance with human safety authority and traceable evidence, not physical or autonomous safety control.

**TURING VALUE:** Directly maps purpose, tools, grounding, memory, human oversight and evaluation to visible behavior while leaving engineering ownership with Gilvan.

Stop after Sprint I. No Showcase submission, URL creation or further sprint is included.

## Preservation and commit boundary

51 of 54 preexisting local file entries remain byte-identical. Three overlapping Command Center files retain their original local features: removing only the enumerated Sprint I adapter additions recovers their backed-up source. The local conversation-active flag is restored by an integration-only adapter that is excluded from the isolated commit. [Preservation evidence](../../artifacts/evaluation/sprint-i/preservation.json). Only isolated source blobs and Sprint I docs/artifacts are staged; no `.env`, corpus, authorization, RAG or primary graph change is included.
