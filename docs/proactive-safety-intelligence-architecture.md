> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Earlier design, validation counts and capability descriptions below belong to their original sprint baseline. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

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

## Persisted cooldown, escalation, and voice queue

INFO and ATTENTION are visual only. HIGH voice is disabled by default and has a four-hour persisted cooldown when enabled. CRITICAL voice is enabled by default and has a 30-minute persisted escalation interval. PostgreSQL stores last visual/voice delivery, delivery count, and next eligibility; reloading the browser cannot bypass policy. A severity transition resets eligibility on the same fingerprint.

The typed queue orders CRITICAL before HIGH and never starts proactive TTS while YvY is listening, transcribing, processing, loading, speaking, or muted. Summaries contain only grounded alert-contract facts. Multiple alerts are grouped into a localized count rather than played as overlapping streams.

## Snooze, history, and context

ATTENTION and HIGH alerts can be snoozed for a bounded period. CRITICAL alerts cannot use normal snooze. Snooze changes neither acknowledgement nor resolution. The drawer filters Active, Acknowledged, Resolved, and All, plus severity.

The current scoped alert group is provided as minimized verified context to the existing conversation thread only for short contextual follow-ups such as “qual?” and “e a segunda?”. It is never stored as long-term memory and cannot authorize HITL.

## Server-authoritative attention

The backend Operational Attention Scheduler is authoritative for deterministic evaluation. It runs once at startup and at a configurable interval, with PostgreSQL advisory-lock leadership and source-level fail-closed resolution. The browser's 90-second cycle now reads compact persisted alert state only; it does not retrieve operational sources or maintain the lifecycle.

Desktop notifications are disabled by default, require explicit browser permission, use a generic non-sensitive count, and remain secondary to the in-app Attention Center.

## Security and HITL

Action queries apply the principal's project allowlist. Approval queries join thread ownership. Repository reads and writes always include `user_id`. Alert acknowledgement does not invoke approval resolution. Critical operations remain subject to explicit on-screen HITL authorization.

No raw audio, credentials, chain-of-thought, or unrestricted model reasoning is stored or exposed. Lifecycle events expose only event type, severity, category, rule, evidence count, and timestamps to Agent Inspector.
