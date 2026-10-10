> **HISTORICAL / VERSIONED REFERENCE (Sprint H audit, 2026-09-09).** Earlier design, validation counts and capability descriptions below belong to their original sprint baseline. Current authority: [architecture](architecture.md), [limitations](limitations.md), [H compliance](capstone/SPRINT_H_FINAL_COMPLIANCE.md) and [security baseline](security-authorization-sprint-d.md). Authentication/RBAC/project isolation and semantic verification are implemented; newer reports supersede conflicting statements below. This notice does not rewrite historical results.

# Server Operational Attention Architecture

## Architecture and evaluator reuse

```text
backend startup / configured interval
  -> local non-overlap guard
  -> PostgreSQL advisory lock
  -> eligible active users and authorized project scopes
  -> OperationalAttentionService
       -> Actions source independently
       -> Approvals source independently
       -> existing evaluateAlerts()
       -> existing PostgresAlertRepository fingerprints/lifecycle
  -> persisted scheduler run and safe metrics
  -> persisted alerts
  -> lightweight browser read / in-app and browser delivery
```

Detection and delivery are separate. The scheduler never invokes an LLM or TTS. The existing deterministic evaluator remains the only severity/detection implementation. In-app voice and optional browser notifications claim persisted delivery eligibility later.

## Scheduling, leadership, and recovery

`YVY_ATTENTION_ENABLED` defaults to `true`; `YVY_ATTENTION_INTERVAL_SECONDS` defaults to 90 and rejects intervals below ten seconds. Startup performs one current-state reconciliation, then schedules from completion, so missed ticks are not replayed and long runs cannot overlap locally. A session-scoped PostgreSQL advisory lock allows only one backend instance to reconcile at a time. The connection releases the lock in `finally`; connection loss also releases it, allowing takeover.

Alerts, acknowledgement, snooze, fingerprints, and cooldown metadata remain in PostgreSQL. Restart therefore performs reconciliation against existing state without resetting delivery eligibility or duplicating alerts.

## Scope and fail-closed reconciliation

The scheduler enumerates active users with `AI_USE`, reconstructs their role permissions, and uses each user's project allowlist. Administrators retain explicit all-project scope. Approval queries remain joined to thread ownership.

Actions and Approvals reconcile separately. Only a successfully retrieved source can resolve alerts in its own categories. If one source fails, the other may reconcile and the run is `PARTIAL`; if all fail it is `FAILED`. Existing alerts from failed sources remain untouched. Safe errors identify only the source and controlled code.

## Run lifecycle and metrics

Runs persist as `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED`, or `SKIPPED`, including timestamps, duration, scopes/sources evaluated, created/updated/resolved counts, and safe error count. Logs contain the same bounded operational fields and never raw records. Health reports enabled/status/leader/running, last run, and last successful run without lock keys or database details.

## Offline and delivery behavior

Server reconciliation can create alerts with no browser open. On return, the first alert-state read groups previously unsurfaced `NEW` alerts by severity before marking them surfaced. CRITICAL has priority. The existing voice preferences, persisted cooldown, queue, mute, and HITL boundaries remain authoritative. The delivery interface is intentionally channel-neutral; no email, SMS, WhatsApp, Slack, or Teams channel is enabled.

## Limitations

Scheduling exists only while at least one backend instance is running. Advisory locking coordinates instances sharing the same PostgreSQL database; it is not a deployment uptime guarantee. Browser state uses compact polling rather than WebSocket push. External delivery channels require a future explicit opt-in integration.


## Sprint D authorization update ? 2026-09-09

See [Sprint D security policy and validation](security-authorization-sprint-d.md) for current project policies, revocation-safe history, approval ownership, write permissions, shared reconciliation lock, validation and remaining limitations. This update supersedes earlier authorization descriptions where they differ.
