# Final defence baseline

2026-09-14; runtime `f9b58d0`. [Canonical final evidence](FINAL_SUBMISSION_BASELINE.md).

Runtime f9b58d0. Defend the controlled workflow, not an autonomous safety authority.
Explain short-term thread context versus explicit long-term memory; memory is not operational evidence.
Explain why missing toolsUsed is normalized but malformed provided state is rejected.
Explain migration 014 user-scoped deduplication; thread compare-and-swap remains future hardening.
Attention/Pending Approvals are deterministic canonical reads, distinct from LLM tool selection.
Draft creation and expanded page-context routing are excluded. Digital LOTO approval does not verify equipment.

## Historical sprint reference

The remainder preserves earlier source evidence. Its counts, local-feature labels and readiness states are superseded by the final baseline above.

# Defence notes

Committed runtime `a0edf23`, branch `capstone/yvy-hse`. H documents existing behavior. Alternatives are design comparisons, not recommendations to change libraries. Local record creation and shared-chat improvements are excluded.

## LangGraph

Code: [buildHseAgentGraph](../../backend/src/ai/graph/hseAgent.graph.ts).

**WHAT:** Explicit graph transitions.

**WHY:** Bound safety and failure routes.

**HOW:** LangGraph state and conditional edges; bounded SDK loop inside agent.

**ALTERNATIVES:** Pure ReAct or Plan-and-Execute.

**TRADE-OFFS:** Less open-ended planning; explicit transitions are easier to inspect.

**FAILURE MODES:** Wrong branch/state or missing runtime; regression tests exercise terminal routes.

**HSE VALUE:** Traceable decision-support workflow.

**PROJECT VALUE:** Advanced controlled execution.


## Runner

Code: [runHseAgent](../../backend/src/ai/graph/hseAgent.runner.ts).

**WHAT:** Runtime composition and conversation entry.

**WHY:** Keep request context and ownership outside prompts.

**HOW:** Resolve thread, load owned state, classify intent, invoke graph, persist and emit trace.

**ALTERNATIVES:** Single monolithic model call.

**TRADE-OFFS:** More orchestration code but explicit boundaries.

**FAILURE MODES:** Invalid thread, persistence or provider failure.

**HSE VALUE:** Continuity without cross-user context.

**PROJECT VALUE:** Integration and application design.


## Guard

Code: [guardNode](../../backend/src/ai/graph/nodes/guard.node.ts).

**WHAT:** Pre-model input/scope controls.

**WHY:** Reject known unsafe and injection requests early.

**HOW:** Deterministic checks and same-thread context.

**ALTERNATIVES:** Model-only moderation.

**TRADE-OFFS:** Finite pattern coverage; conservative refusal possible.

**FAILURE MODES:** Unseen phrasing or false positives.

**HSE VALUE:** Reduce unsafe input exposure.

**PROJECT VALUE:** Safety and testable control flow.


## Tools

Code: [createHseTools](../../backend/src/ai/tools.ts).

**WHAT:** Scoped registered capabilities.

**WHY:** Get current operational facts from records.

**HOW:** Zod input schemas, parameterized SQL, server principal and field minimization.

**ALTERNATIVES:** Free SQL generation or prompt-only data.

**TRADE-OFFS:** Controlled coverage instead of unrestricted database access.

**FAILURE MODES:** Tool/SQL outage, empty results, bad arguments; controlled errors.

**HSE VALUE:** Traceable operational facts.

**PROJECT VALUE:** Tool integration.


## RAG

Code: [RagRetrievalService](../../backend/src/ai/rag/retrieval.service.ts).

**WHAT:** Approved knowledge retrieval.

**WHY:** Ground procedural support in identifiable sources.

**HOW:** Original semantic query plus bounded PT lexical expansion, gates, RRF and citations.

**ALTERNATIVES:** Semantic-only, keyword-only or fine-tuning.

**TRADE-OFFS:** Small corpus and controlled glossary; ANN deferred.

**FAILURE MODES:** No evidence, wrong jurisdiction, source/provider failure; abstain or declared degradation.

**HSE VALUE:** Procedural references without invented authority.

**PROJECT VALUE:** Complementary retrieval and evaluation.


## Memory

Code: [ControlledMemoryService](../../backend/src/ai/memory/memory.service.ts).

**WHAT:** Explicit user-owned durable preferences.

**WHY:** Retain useful context without full transcript persistence.

**HOW:** Allowlisted categories, bounded content, explicit intent, repository owner filter and forget.

**ALTERNATIVES:** No persistence or unrestricted transcript memory.

**TRADE-OFFS:** Limited recall and conservative sensitive-data checks.

**FAILURE MODES:** Injected or stale memory; remains untrusted and cannot authorize.

**HSE VALUE:** Relevant workflow preferences.

**PROJECT VALUE:** State and controlled memory.


## Verification

Code: [verifyEvidenceContract](../../backend/src/ai/graph/semanticVerifier.ts).

**WHAT:** Deterministic evidence contract checking.

**WHY:** Separate a fluent answer from supported claims.

**HOW:** Structural checks plus operational facts, source/citation, jurisdiction and safety assertions.

**ALTERNATIVES:** Model judge or structural-only checks.

**TRADE-OFFS:** Finite deterministic patterns are auditable but not a truth oracle.

**FAILURE MODES:** Unsupported or misleading claims yield controlled failure/abstention.

**HSE VALUE:** Avoid treating prose as field proof.

**PROJECT VALUE:** Outcome validation.


## HITL

Code: [PostgresApprovalService](../../backend/src/ai/hitl/hitl.repository.ts).

**WHAT:** Authenticated digital critical-workflow decision.

**WHY:** Reserve critical authorization for a permitted human.

**HOW:** Classify LOTO, persist PENDING, resolve matching owned/scoped pending request once.

**ALTERNATIVES:** Native checkpoint resume or autonomous approval.

**TRADE-OFFS:** Application transition; equipment binding remains limited.

**FAILURE MODES:** Missing scope, foreign owner, duplicate/rejected decision; fail closed.

**HSE VALUE:** Human authority remains explicit; no physical execution.

**PROJECT VALUE:** Advanced human-in-the-loop control.


## Authorization

Code: [assertProjectAccess](../../backend/src/auth/authorization.ts).

**WHAT:** Server permissions and project access.

**WHY:** Prevent model/client claims from widening access.

**HOW:** Session principal, RBAC, table/field policies, project and owner checks.

**ALTERNATIVES:** Client filtering or database RLS.

**TRADE-OFFS:** Application-level enforcement; transactional reassignment hardening remains.

**FAILURE MODES:** Revoked/empty/foreign scope denied; free text remains a privacy limitation.

**HSE VALUE:** Evidence stays within responsible project access.

**PROJECT VALUE:** Ethics, privacy and security.


## Intent Router

Code: [classifyIntent](../../backend/src/ai/intent/intentRouter.ts).

**WHAT:** Deterministic intent selection.

**WHY:** Choose bounded permitted capabilities and clarify ambiguity.

**HOW:** Domain rules, operational precedence, same-thread follow-ups and methodological knowledge routing.

**ALTERNATIVES:** LLM planner or classifier.

**TRADE-OFFS:** Transparent rules with finite language coverage.

**FAILURE MODES:** Unrecognized phrase or ambiguous context; clarification.

**HSE VALUE:** Route operational facts separately from guidance.

**PROJECT VALUE:** Predictable tool orchestration and 134-case evaluation.


## Evaluation

Code: [runEvaluationHarness](../../backend/src/ai/evaluation/evaluation.harness.ts).

**WHAT:** Independent labelled expectations.

**WHY:** Measure failures and reproducibility honestly.

**HOW:** Real graph/components under fake model/DB, network block, source/config fingerprints; separate real retrieval.

**ALTERNATIVES:** Only unit tests or only live subjective review.

**TRADE-OFFS:** Reproducible controls do not establish live answer quality.

**FAILURE MODES:** Fixture mismatch, weak labels or provenance drift; report failures.

**HSE VALUE:** Assess controls before relying on answers.

**PROJECT VALUE:** Measured outcomes and reproducibility.


## Observability

Code: [withExecution](../../backend/src/ai/observability/context.ts).

**WHAT:** Per-run safe diagnostics.

**WHY:** Explain route, evidence and failures without dumping payloads.

**HOW:** AsyncLocalStorage, allowlisted logs, durations, prompt identity and sanitized Inspector.

**ALTERNATIVES:** Raw request logs or third-party tracing.

**TRADE-OFFS:** Session-local Inspector; no immutable audit retention; cost unavailable.

**FAILURE MODES:** Missing provider usage, unrelated voice run, storage loss.

**HSE VALUE:** Trace decisions without exposing full records.

**PROJECT VALUE:** Explainability and failure analysis.


## Voice

Code: [ElevenLabsAdapter](../../backend/src/ai/voice/elevenlabs.ts).

**WHAT:** Spoken response adapter.

**WHY:** Make consultation accessible while retaining visible evidence.

**HOW:** Validated ElevenLabs requests/catalogs; browser speech input; controlled errors.

**ALTERNATIVES:** Browser-only TTS or another provider.

**TRADE-OFFS:** External processing and browser-dependent STT.

**FAILURE MODES:** Provider/voice/network failure; use text, no silent approval.

**HSE VALUE:** Hands-free consultation where appropriate.

**PROJECT VALUE:** Interactive prototype and resilience.


## Attention

Code: [OperationalAttentionService](../../backend/src/ai/attention/operational-attention.service.ts).

**WHAT:** Operational signal evaluation and alert lifecycle.

**WHY:** Surface records needing review.

**HOW:** Scoped server evaluation, current-source checks, reconciliation lock, acknowledge/snooze.

**ALTERNATIVES:** Client timers or autonomous corrective writes.

**TRADE-OFFS:** Shared lock trades throughput for exclusion; not remediation.

**FAILURE MODES:** Stale/revoked evidence excluded; concurrent runs can be busy.

**HSE VALUE:** Focus human review on operational signals.

**PROJECT VALUE:** Controlled proactive assistance.

## Project presentation orchestrator (Sprint I)

See [Demo Mode defence note](TURING_DEMO_MODE.md#defence-note): deterministic presentation order reuses actual graph execution; it is not another agent. Gilvan retains architecture explanation and manual approval. Full manual acceptance remains pending.
