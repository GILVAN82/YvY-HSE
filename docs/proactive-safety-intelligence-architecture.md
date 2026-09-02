# Proactive Safety Intelligence Architecture

## Scope and sources

YvY evaluates only two sources with explicit current-state semantics: authorized overdue records from `action_tracker_capa`, and pending critical records from `agent_human_approval` joined to the authenticated user's agent threads. Incidents, permits, and KPI deterioration are intentionally excluded until their lifecycle and threshold contracts are defined.

```text
authenticated request
  -> RBAC-scoped operational queries
  -> deterministic alert evaluator
  -> evidence + severity + fingerprint
  -> PostgreSQL alert repository
  -> in-app Attention Center
  -> optional controlled TTS
  -> acknowledgement / later condition resolution
```

## Rules and evidence

- An open action with a past target date produces ATTENTION.
- The same condition with HIGH or CRITICAL source priority produces HIGH.
- A PENDING critical HITL approval belonging to the user's thread produces CRITICAL.
- Empty query results, current actions, closed actions, and resolved approvals produce no candidate.

Each alert stores its source type/id, deterministic rule ID, and minimized evidence fields. No LLM classifies severity or writes alert facts.

## Lifecycle and deduplication

The fingerprint is `category + source record`. PostgreSQL enforces uniqueness per user. Re-evaluation updates the same alert, including severity changes. Conditions missing from the complete scoped evaluation become RESOLVED. Reading NEW alerts marks them ALERTED. Acknowledge records the authenticated user and timestamp but never marks the condition RESOLVED.

## Alert fatigue and voice policy

INFO and ATTENTION are visual only. HIGH voice is disabled by default. CRITICAL voice is enabled by default and uses a deterministic localized count summary rather than raw records. Session-level delivery keys prevent repeated speech; existing TTS cancellation prevents overlapping streams. No proactive speech starts while YvY is listening, processing, loading, speaking, or muted.

## Security and HITL

Action queries apply the principal's project allowlist. Approval queries join thread ownership. Repository reads and writes always include `user_id`. Alert acknowledgement does not invoke approval resolution. Critical operations remain subject to explicit on-screen HITL authorization.

No raw audio, credentials, chain-of-thought, or unrestricted model reasoning is stored or exposed. Evaluation runs on load or explicit refresh; there are no fake monitoring timers.
