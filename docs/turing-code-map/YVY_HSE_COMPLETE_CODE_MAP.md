# YvY HSE Complete Code Map

Branch: `capstone/yvy-hse`. Runtime HEAD: `a0edf2398be4ac4cc91947f8b614460e548b35ad`. Sprint H adds documentation only. Approximate start lines are generated from committed source and current local files on 2026-09-09; search the named symbol if edits move lines.

COMMITTED is the review baseline. LOCAL / UNCOMMITTED includes record drafts, broader automatic app-module intent routing, incident-count fallback and chat layout/history refinements. FUTURE includes Demo Mode. The prior untracked map was backed up before this authorized rewrite; its obsolete branch and line references are not used.

| Component | File | Symbol/function | COMMITTED approximate line | LOCAL approximate line | Purpose |
|---|---|---|---:|---:|---|
| LangGraph | [backend/src/ai/graph/hseAgent.graph.ts](../../backend/src/ai/graph/hseAgent.graph.ts) | `buildHseAgentGraph` | 27 | 27 | Explicit graph transitions |
| Runner | [backend/src/ai/graph/hseAgent.runner.ts](../../backend/src/ai/graph/hseAgent.runner.ts) | `runHseAgent` | 97 | 97 | Runtime composition and conversation entry |
| Guard | [backend/src/ai/graph/nodes/guard.node.ts](../../backend/src/ai/graph/nodes/guard.node.ts) | `guardNode` | 97 | 97 | Pre-model input/scope controls |
| Tools | [backend/src/ai/tools.ts](../../backend/src/ai/tools.ts) | `createHseTools` | 63 | 63 | Scoped registered capabilities |
| RAG | [backend/src/ai/rag/retrieval.service.ts](../../backend/src/ai/rag/retrieval.service.ts) | `RagRetrievalService` | 27 | 27 | Approved knowledge retrieval |
| Memory | [backend/src/ai/memory/memory.service.ts](../../backend/src/ai/memory/memory.service.ts) | `ControlledMemoryService` | 59 | 59 | Explicit user-owned durable preferences |
| Verification | [backend/src/ai/graph/semanticVerifier.ts](../../backend/src/ai/graph/semanticVerifier.ts) | `verifyEvidenceContract` | 142 | 148 | Deterministic evidence contract checking |
| HITL | [backend/src/ai/hitl/hitl.repository.ts](../../backend/src/ai/hitl/hitl.repository.ts) | `PostgresApprovalService` | 13 | 13 | Authenticated digital critical-workflow decision |
| Authorization | [backend/src/auth/authorization.ts](../../backend/src/auth/authorization.ts) | `assertProjectAccess` | 34 | 34 | Server permissions and project access |
| Intent Router | [backend/src/ai/intent/intentRouter.ts](../../backend/src/ai/intent/intentRouter.ts) | `classifyIntent` | 10 | 11 | Deterministic intent selection |
| Evaluation | [backend/src/ai/evaluation/evaluation.harness.ts](../../backend/src/ai/evaluation/evaluation.harness.ts) | `runEvaluationHarness` | 87 | 87 | Independent labelled expectations |
| Observability | [backend/src/ai/observability/context.ts](../../backend/src/ai/observability/context.ts) | `withExecution` | 11 | 11 | Per-run safe diagnostics |
| Voice | [backend/src/ai/voice/elevenlabs.ts](../../backend/src/ai/voice/elevenlabs.ts) | `ElevenLabsAdapter` | 28 | 28 | Spoken response adapter |
| Attention | [backend/src/ai/attention/operational-attention.service.ts](../../backend/src/ai/attention/operational-attention.service.ts) | `OperationalAttentionService` | 14 | 14 | Operational signal evaluation and alert lifecycle |
| Agent node | [backend/src/ai/graph/nodes/agent.node.ts](../../backend/src/ai/graph/nodes/agent.node.ts) | `agentNode` | 79 | 82 | Only model-facing graph node; bounded tool loop |
| Query policy | [backend/src/ai/rag/queryPlan.ts](../../backend/src/ai/rag/queryPlan.ts) | `deterministicQueryPlan` | 15 | 15 | Structured original/semantic/lexical query plan |
| Short-term memory | [backend/src/ai/graph/threadState.repository.ts](../../backend/src/ai/graph/threadState.repository.ts) | `PostgresThreadStateStore` | 54 | 54 | User-owned bounded thread persistence |
| HITL policy | [backend/src/ai/hitl/hitl.policy.ts](../../backend/src/ai/hitl/hitl.policy.ts) | `classifyAgentAction` | 3 | 3 | Critical LOTO classification |
| Approval gate | [backend/src/ai/graph/nodes/approval.node.ts](../../backend/src/ai/graph/nodes/approval.node.ts) | `approvalGateNode` | 8 | 8 | Persist pending or continue |
| Prompt composer | [backend/src/ai/prompts/composer.ts](../../backend/src/ai/prompts/composer.ts) | `buildAgentPrompt` | 21 | 21 | Eight policy modules and lower-role untrusted context |
| Model boundary | [backend/src/ai/modelStream.ts](../../backend/src/ai/modelStream.ts) | `validatedModelStream` | 19 | 19 | Validate SDK stream and classify provider errors |
| Generic app tools | [backend/src/ai/appDataTools.ts](../../backend/src/ai/appDataTools.ts) | `createAppDataTools` | 14 | 14 | Policy-controlled registered-table read access |
| Production binding | [backend/src/ai/productionDependencies.ts](../../backend/src/ai/productionDependencies.ts) | `createProductionAiComposition` | 28 | 29 | Production-only DB/provider services |
| SSE HTTP | [backend/src/routes/aiChat.ts](../../backend/src/routes/aiChat.ts) | `createAiChatRouter` | 65 | 69 | Authenticated request and SSE boundary |
| Inspector | [frontend/src/app/core/agent-inspector.service.ts](../../frontend/src/app/core/agent-inspector.service.ts) | `AgentInspectorService` | 62 | 62 | Sanitized session snapshot |
| Retrieval evaluation | [backend/src/ai/rag/multilingual.cli.ts](../../backend/src/ai/rag/multilingual.cli.ts) | `main` | 27 | 27 | 24-query real cached-vector replay |

## Review sequence

Open graph, runner, guard and agent node first; then tool registry and production binding to explain authority. Use retrieval/query policy for RAG, semantic verifier for grounding, memory repositories for ownership and HITL policy/repository for digital approval. Finish with evaluation and Inspector. Show only the eight fields in the [demo plan](../capstone/TURING_DEMO_CONTENT_PLAN.md).

## Local-only navigation

`backend/src/ai/recordDrafts.ts` and `frontend/src/app/shared/record-review/` implement unfinished local draft/review work. They are not part of the runtime commit above. The unchanged local delta is inventoried in the [H preservation manifest](../../artifacts/evaluation/sprint-h/preservation.json).

## Sprint I presentation layer

Based on H `4e8f52b`; source map above remains the primary agent baseline.

| File | Symbol | Purpose |
|---|---|---|
| `backend/src/routes/turingDemo.ts` | `readDemoConfiguration`, `productionDemoProbe`, `createTuringDemoRouter` | Server flag and read-only authenticated preflight |
| `frontend/src/app/pages/ai-command-center/demo/demo-script.ts` | `DEMO_STEPS` | Six deterministic presentation definitions |
| `frontend/src/app/pages/ai-command-center/demo/turing-demo.service.ts` | `TuringDemoService` | Sequence, real sends, owner/cancellation fences, manual-decision observation |
| `frontend/src/app/pages/ai-command-center/yvy-command-center-agent.service.ts` | `beginPresentation`, `endPresentation` | Isolate and restore presentation conversation without deleting persisted state |
| `frontend/src/app/pages/agent-inspector/agent-inspector.component.html` | `demo-preset` | Filter existing execution metadata; no fake snapshots |
