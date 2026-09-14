# Canonical YvY Evidence View

`EvidenceViewComponent` renders the shared `EvidenceViewModel`. Operational cards call `presentOperationalEvidence`; RAG, partial/fallback responses and approval explanations call `presentResponseEvidence` through `ResponseEvidenceComponent`. Both the Command Center and chat widget use these components. Turing Demo inherits the same implementation without a demo-specific evidence UI.

## User-facing contract

The view separates conclusion, supporting explanation, source, optional scope/jurisdiction, evidence items, optional query time, limitations and real next actions. Internal verification is mapped to localized **Verified**, **Partially verified**, **Needs confirmation**, **No matching records**, **Evidence unavailable** or **Human decision required**. Query success alone never upgrades a partial answer to verified.

- Operational evidence reuses canonical counts and KPI presentation. Only allowlisted business identifiers and known record statuses appear; source links use existing register routes.
- Zero results retain the explicit business conclusion, such as no open incidents, and explain that a successful query returning zero is not a retrieval failure.
- RAG evidence shows the retrieved document title, citation, bounded source passage, organization, version, jurisdiction and valid HTTP(S) document link when provided. A source jurisdiction is not presented as proof of applicability to the user's project.
- Partial evidence separates available sources from missing support, explains the verification limitation and asks the user to review sources. When the backend does not identify exactly what is missing, the view says so rather than guessing or displaying raw verifier reasons.
- Approval evidence explains the need for an authorized human decision. LOTO explicitly states that YvY cannot confirm physical isolation or safe site conditions. A recorded approval does not turn physical conditions into verified facts. The optional action only focuses the existing approval controls; it never approves or rejects anything. Updates are matched to the original approval and thread.

## Provenance and limits

The additive `evidencePresentation` response field is an allowlisted projection of already-authorized operational evidence and approved RAG results. It is separate from technical execution metadata. Scope is shown only for an explicit, successful project query; wildcard or missing scope is omitted. Query time is labelled as historical query information, not a live freshness guarantee. Missing document passages and jurisdictions are never reconstructed. Long source passages are visibly truncated.

At most eight record identifiers per source and eight retrieved source passages are exposed. Descriptions, personal details, arbitrary tool objects, opaque source/chunk IDs, vector/RRF scores and embedding/configuration fields are not projected. The existing trace has no call IDs, so repeated calls to the same tool do not receive guessed record-level evidence or scope associations.

The Agent Inspector UI, verification logic, source authorization, RAG retrieval and HITL decisions remain unchanged. The Evidence View does not parse raw trace JSON into display text. Unknown capabilities receive a generic business fallback through the same contract; new specialized domains should supply business evidence, not raw metadata.

EN, PT, ES, FR and DE labels are centralized in `evidence-copy.ts`; supplied document titles, passages and business identifiers retain their source language. Query times follow the selected locale. Optional actions are rendered only for existing register routes, valid source URLs or actual approval controls supplied by the host.

## Review value

- **Turing:** outcome quality, UI/interaction quality and ethical AI transparency.
- **Jochen:** grounding, successful zero-result semantics and a focused demo.
- **Vytautas:** traceable sources and their actual scope.
- **Andrius:** explainability and separation of concerns.
- **Justinas:** actionable source and approval navigation.
- **Fatima:** shared typed presentation contracts.

## Validation

Tests cover verified operational evidence, zero results, RAG passages and links, partial evidence, human-decision requirements, unrelated/stale approvals, future-source fallback, absent scope/jurisdiction/time, localization and rendered exclusion of technical metadata. Backend projection tests cover field minimization, ambiguous repeated calls, failed queries and bounded excerpts. Full frontend/backend regression, typechecks and production builds are required before the commit.

Validation results: integrated frontend 195/195 and backend 406/406 tests; isolated commit frontend 187/187 and backend 388/388 tests. Frontend/application/spec and backend typechecks passed. Production builds passed with Angular bundle/style size warnings below error limits. The existing agent, intent and retrieval regression suites passed. No presentation, approval decision or live RAG ingestion was executed.
