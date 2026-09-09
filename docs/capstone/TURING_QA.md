# Turing review Q&A

Runtime `a0edf23`; answers scoped to committed behavior. [Evidence and trade-offs](DEFENCE_NOTES.md).

## Why LangGraph?

Explicit state and branches make guard, verification, failure and human approval inspectable.

## Why not pure ReAct?

The bounded inner tool loop is ReAct-like; deterministic outer controls must retain authority.

## Why not Plan-and-Execute?

The current finite consultation tasks do not need a separate planner. No planner is claimed.

## Why RAG?

Procedural answers need traceable approved sources; operational records use separate database tools.

## Why hybrid retrieval?

Vector similarity alone missed targeted Portuguese terminology in the small approved English corpus; lexical expansion recovered those cases.

## Why RRF?

Rank fusion combines lexical and semantic rankings without treating their raw scores as interchangeable. Relevance gates still apply.

## How does memory work?

Owned bounded thread state and separate explicit safe preferences are stored in PostgreSQL. Forget disables a durable memory.

## Why is memory untrusted?

It originates from users and may be stale or injected; it cannot become system policy, approval or approved evidence.

## How does HITL work?

A deterministic LOTO policy creates a scoped pending digital decision. A permitted authenticated human resolves it once through application state transition.

## Can YvY execute LOTO?

No. It cannot isolate equipment, verify zero energy, issue physical authorization or replace competent field personnel.

## How do you evaluate it?

Separate unit/HTTP/frontend tests, simulated graph evaluation, deterministic intent labels, real cached retrieval and opt-in live-provider evaluation.

## What does 44/44 prove?

All 44 labelled offline scenarios met their explicit checks in the recorded baseline. It does not prove live-model accuracy.

## What does 100% retrieval mean?

Hybrid required/relevant recall on 24 targeted queries against four approved summaries. The two negative cases also test abstention.

## What does it NOT mean?

It does not mean universal recall, all-language coverage, legal correctness or 100% generated-answer quality.

## How do you prevent hallucinations?

I reduce risk with scoped tools, approved sources, citations, deterministic verification and abstention; prevention is not guaranteed.

## What happens with no evidence?

Controlled no-data/no-evidence or verification failure outcomes replace unsupported claims; database failure is not an empty successful query.

## How do you handle user/project isolation?

Server session principal, RBAC, scoped SQL and ownership checks run outside model authority. Company-level tenancy is not implemented.

## How do you handle provider failure?

Validate near the boundary, classify timeout/rate/auth/schema/unavailable errors and expose controlled failure metadata. No unapproved silent model switch.

## Why ElevenLabs?

It is the implemented spoken-summary integration with validated requests and failure handling; this project does not claim a benchmark proving it superior. STT remains browser-dependent.

## What would you improve next?

First rehearse the bounded demo and finish Showcase submission; separately expand live/independent evaluation, equipment binding, transactional hardening and deployment governance.
