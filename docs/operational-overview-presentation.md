# Canonical Operational Overview presentation

Operational Overview cards and supporting evidence use `OperationalOverviewComponent` and `presentOperationalResult`, shared by the Command Center (including YvY HSE Demo) and the chat widget. Business templates consume `OperationalOverviewViewModel`, not raw execution summaries, arguments or statuses.

The view model contains title, primary value, business status, summary, evidence label/state/summary, available metrics and navigation actions. Domain adapters share this contract; adding a domain to the registry does not require per-card conditions in a template. Unknown operational sources fall back to localized operational-data availability without displaying their tool name, JSON or arguments. New business renderers must reuse this component or this presenter, including future permits, audits, training and document overviews.

## Semantics

- Actions use an explicit pending count, never an execution status or an unfiltered row count. A query capped at its limit is labelled “At least” rather than claiming an exact total.
- Incidents use open count independently of total incident count and returned rows. Zero open incidents remains a successful business result.
- KPI cards display only available TRIR, LTIFR and days-since-LTI values. With no numeric metrics they show data availability; successful empty queries show no matching indicators.
- Query execution and evidence verification are independent. Error means data unavailable; verified, partially verified and insufficient evidence retain distinct business labels. Success alone does not imply verification.
- Old results that contain only a masked technical summary cannot recover lost numbers. Known legacy count formats can be read, but raw summaries are never displayed. Otherwise the presenter uses safe availability text.
- EN, PT, ES, FR and DE labels are centralized in `operational-copy.ts` and follow the selected UI language. The evidence heading uses an em dash.

## Minimal transport addition

The existing trace has an optional `presentationFacts` field, validated by a narrow schema. It carries only nonnegative numeric counts, a lower-bound indicator and allowlisted KPI values from the already-authorized tool result. No rows, names, raw arguments or arbitrary result objects are added. Tool queries, evidence semantics, verification, authorization, RAG and HITL are unchanged. The existing Agent Inspector UI and its technical metadata remain unchanged.

## Review value

- Project: clearer interaction and outcome quality across normal and demo use.
- Jochen: successful zero-result semantics and focused, understandable presentation.
- Fatima: typed contracts and explicit responsibilities.
- Andrius: separation of business presentation from execution metadata.
- Justinas: actionable records links and meaningful operational information.

## Validation

Presenter tests cover pending actions (4/0), open incidents (2/0), KPI availability/values/empty results, execution errors, verification states, five languages, lower-bound counts and safe future-source fallback. Preventive assertions reject technical status tokens, raw JSON, filters and row-count field names in business output. Integration tests cover cards, source-specific evidence expansion and the shared widget renderer. Backend tests cover the allowlisted numeric transport and zero-result preservation.

Integrated workspace: frontend 177/177 and backend 402/402 tests passed. The isolated commit also passed frontend 169/169 and backend 384/384 tests. Typechecks and production builds passed; Angular reported bundle/style size warnings below the error limits. The backend suite includes the 44/44 agent evaluation, the 134-case intent dataset and retrieval regression tests. No live RAG ingestion, provider evaluation or Project presentation was run.
