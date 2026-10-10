# Current YvY architecture

Runtime baseline: `a0edf23` on `capstone/yvy-hse`. [Code map](turing-code-map/YVY_HSE_COMPLETE_CODE_MAP.md) has current symbol locations; [defence](capstone/DEFENCE_NOTES.md) explains decisions.

Authenticated request -> deterministic intent routing -> guard -> agent with bounded SDK tool loop -> scoped tools/retrieval -> structural and semantic verification -> approval gate -> finalization -> SSE/UI.

Refusal, model/tool failure, missing evidence and pending human approval are explicit outcomes. The gate is visited after valid verification; only classified critical requests persist a pending approval. Later resolution is an authenticated application transition, not native durable LangGraph checkpoint resume.

This is a Controlled State Graph / Workflow Agent. A ReAct-like action/observation loop exists inside the agent node; no independent planning agent or Plan-and-Execute engine is implemented. The visual HSE ring is navigation/topic grouping, not a multi-agent system.

The API composes scoped repositories and tools. Authentication, project policies, ownership and approval permissions are server controls outside the LLM. PostgreSQL stores operations, user-owned state, memories and decisions. Memory/attachments/tool text are untrusted data; eight prompt modules own policy. Observability uses request-local context and safe metadata.

RAG: original semantic query + structured plan + bounded PT lexical expansion -> vector/lexical candidates -> threshold/topic/exact/jurisdiction gates -> RRF -> top-k evidence -> required-source completeness -> citation and answer verification -> abstention. See [F.2](capstone/SPRINT_F2_MULTILINGUAL.md). Four approved documents, 1536-dimensional text-embedding-3-small vectors, threshold 0.45; ANN deferred. Jurisdiction is checked on candidates and on answer claims, not inferred from similarity alone.

Voice uses browser-dependent input and ElevenLabs output; attention is a scoped server signal/reconciliation service. Neither can approve field work. Legacy runtime remains available for compatibility and lacks graph parity.

[Baseline distinctions](capstone/SPRINT_H_FINAL_COMPLIANCE.md): local record drafts, broad automatic module routing, incident count fallback and shared-chat refinements are not committed runtime capabilities. H changes documentation only.
