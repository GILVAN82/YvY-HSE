> **VERSIONED SECURITY BASELINE: Sprint D (`1d93165`).** Its implemented authorization controls remain applicable; its test counts and scope exclusions are historical. See [H current gates and residual risks](capstone/SPRINT_H_FINAL_COMPLIANCE.md).

# SPRINT D ? AUTHORIZATION & ATTENTION ISOLATION

Date: 2026-09-09. This is a scoped engineering validation, not a security certification.

## Authorization contract

Every production request uses the authenticated server principal. ADMIN has an explicit global policy (`null` scope); a non-admin empty project list means zero projects. HSE_MANAGER has operational HSE_DATA_WRITE in addition to read and HITL permissions. HSE_USER and APPROVER do not gain operational write permission. Global reference writes and project administration require ADMIN. The existing global write switch remains an additional gate, never a grant of authority.

The literal registry `backend/src/auth/table-access-policy.json` covers all 39 registered tables. Direct tables use their project column. JSA steps derive scope from jsa_log; audit findings derive it from audit_tracker. All matching parents must be authorized, so ambiguous identifiers cannot expose another project. Missing parents fail closed. Explicit global references are legal_compliance_register and emergency_preparedness__emergency_response_plan_summary. Contractor management, document control and change log are unavailable to the agent; unresolved app scope is restricted to administrators. A missing project column never implies global access.

Each policy declares allowedForModel, requiredForEvidence and blocked fields. SQL selects allowed model fields, and result projection drops unexpected fields. Author/reviewer names, change authors, signatures and contact details are not implicitly forwarded. Emergency contact records have no model allowlist. Unknown tables fail closed. Existing specialized operational tools retain their own minimized contracts; RAG behavior was not changed.

## Revocation and historical disclosure

Alert listing, return summary, lifecycle history, surface, claim, acknowledge, snooze and spoken completion join current active user authorization and the current operational source. Previously authorized but now revoked or deleted sources disappear from historical API results as well as active results. A denied mutation returns a structured error, not a successful empty result. SQL repeats access predicates at mutation time. Source ownership remains mandatory for HITL alerts. Duplicate action identifiers involving an unauthorized project are hidden.

Reconciliation distinguishes admin/global from empty scope and rechecks live membership even if its principal snapshot is stale. Manual evaluation and scheduled execution use the same PostgreSQL advisory lock. A competing manual call returns BUSY without evaluating a stale snapshot. The lock is global and deliberately serializes users too.

YvyAlertService observes authentication independently of Command Center mounting. Identity changes clear protected alert/history/voice/attention state, abort requests and invalidate generations. Identity is rechecked before applying asynchronous completions, including the interval before Angular effects flush. Preferences are namespaced per user.

Persisted conversation context records the authorization scope. Loading a legacy context with no scope, a context containing revoked projects, or another owner's thread is denied. A new conversation is required for inaccessible legacy context. Revocation governs subsequent server access; it cannot retract information already delivered to a browser or guarantee deletion from screenshots or external copies.

## LOTO and reviewed writes

Migration 013 adds requested_by and scope_projects to approvals. Creation requires an authenticated owner and explicitly named existing project codes. Resolution requires HITL_APPROVE, the same request owner, owned thread, a nonempty authorized project scope and a PENDING state. The final UPDATE rechecks current membership and active role. ADMIN does not bypass request ownership. Legacy approvals with unknown owner/scope cannot be approved. Repeated resolutions retain conflict behavior. Human approval records a decision; it does not perform physical LOTO.

Generic writes require HSE_DATA_WRITE, module policy and source/destination project scope. Child records derive permission from parents. Existing local record-draft integration additionally requires HSE_DATA_WRITE when saving and validates the original record scope before a move. The model cannot grant permission or mark an unreviewed draft saved.

## Error and logging contract

AUTHENTICATION_REQUIRED = missing/invalid session (401).
AUTHORIZATION_DENIED, PROJECT_SCOPE_DENIED, RESOURCE_OWNERSHIP_DENIED = authorization failures (403).
RESOURCE_NOT_FOUND = missing resource (404).
AUTH_UNAVAILABLE / DATA_QUERY_FAILED / THREAD_UNAVAILABLE = infrastructure failure (503 at the relevant HTTP boundary).

Operational tool denials preserve their authorization code and force the graph failure path rather than a no-data answer. Logs contain timestamp, requestId, runId, threadId when available, role, resource type, operation, denied scope decision and error category. They exclude request bodies, cookies, tokens and operational descriptions. Background/standalone calls may have null request/run context.

## Validation

Integrated working tree: backend 335/335, frontend 117/117. Backend typecheck/build and frontend app/spec typechecks/production build passed. Backend default tests passed with DATABASE_URL and provider keys removed from the process. No default test requires a live database or provider.

The opt-in `backend/src/auth/sprint-d.smoke.cli.ts` passed 13 PostgreSQL checks using temporary tables inside a rolled-back transaction: owner and project isolation, current-source history, voice claim/completion, acknowledge/snooze after revocation, empty scope, stale reconciliation and derived scope. No operational records were changed. Migration 013 was applied separately to the configured local database.

A?F and I?P are covered by `backend/src/auth/__tests__/sprint-d.test.ts`, existing voice/repository tests and the opt-in SQL validation. G?H are covered by frontend service tests without a mounted Command Center. The shared-lock test runs the real scheduler against an injected lock database while manual evaluation competes.

Production CSS budgets were not increased. Ordered stylesheet splitting preserves compiled rules and visual behavior. Warning thresholds still report the initial bundle and two stylesheets; error thresholds pass.

## Working tree and commit boundary

The initial 34 modified and 15 untracked entries were inventoried and backed up before editing. No environment file was changed by this Sprint. Security changes are assembled and tested against HEAD in a separate temporary tree before staging. The explicit app-data policy requires the related appDataTools module. Preexisting semantic-verification, adaptive workspace, shared-chat, record-draft feature and code-map work remain outside the security commit. Security integration changes to those local features, plus their CSS build split, remain in the working tree. The isolated commit candidate passed 317 backend tests and 111 frontend tests, both production builds and backend typecheck. Consequently integrated and isolated test counts differ; neither count substitutes for the other.

## Remaining limitations

- This is not an exhaustive penetration test or an external privacy certification.
- Operational free text can contain personal data even when column allowlists are correct; no universal free-text DLP is claimed.
- LOTO scope currently requires exact project-code tokens. Equipment-level resource binding and delegated/team approval are not implemented; unresolved requests are blocked.
- Generic write checks use a request principal and parent lookups; fully transactional resource moves and concurrent project/parent reassignment need further hardening. Subsequent requests use refreshed authorization.
- Previously delivered browser content cannot be remotely revoked. Same-user permission changes are enforced on server access; identity changes explicitly reset frontend state.
- Global reference classification is explicit policy and needs business review when modules or sensitive fields change.
- Ambiguous contractor project mappings remain unavailable to the model pending a normalized relation.
- Legacy approval and thread scope is not guessed or backfilled. Recreate inaccessible requests/conversations.
- RAG hardening and Turing Demo Mode are outside this Sprint.

## TURING CAPSTONE & REVIEW COMPLIANCE

| Reviewer / criterion | Status | Evidence / boundary |
|---|---|---|
| Turing ? ethics/privacy | ? IMPLEMENTED | Ownership, project policy, column minimization; free-text privacy remains partial |
| Turing ? tool integration | ?? VALIDATED | Scoped generic access and model-output projection tests |
| Turing ? functional product | ?? VALIDATED | Integrated tests and production builds; no live UI acceptance claim |
| Turing ? advanced agent behavior | ? IMPLEMENTED | Revocation-aware attention and typed graph failures; no RAG changes |
| Jochen ? HITL | ?? VALIDATED | Owner/project denial and PostgreSQL resolution checks |
| Jochen ? hermetic tests | ?? VALIDATED | Default suite runs without provider/database configuration |
| Jochen ? frontend tests | ?? VALIDATED | 117 integrated tests, including identity races |
| Stefano ? safeguards | ?? VALIDATED | Negative authorization scenarios A?P |
| Andrius ? ownership / failures / errors | ?? VALIDATED | Fail-closed scope and explicit error taxonomy |
| Justinas ? resilience / near-source errors | ? IMPLEMENTED | Shared lock and infrastructure taxonomy; transactional moves remain |
| Fatima ? impossible states / contracts / ownership | ? IMPLEMENTED | Explicit table policy and scoped PENDING transition; equipment contract remains |

Newly validated: empty-scope isolation, revoked-source history and voice, frontend late-response discard, LOTO ownership, derived scope, read-only write denial and scheduler/manual exclusion.
Remaining: the limitations above, production load/penetration assessment and separate business approval of global classifications.

## DEFENCE NOTE

WHAT: Enforce identity, permission, project scope and ownership across operational reads, attention and human approvals.
WHY: User ownership alone did not prevent disclosure after project revocation or approval of a known foreign resource.
HOW: Explicit table and field policies, current-source SQL predicates, bound approval/thread services, typed denials, a shared advisory lock and frontend identity generations.
ALTERNATIVES: Database row-level security could strengthen transaction-wide enforcement, but requires a separate connection/session and migration design. Regex-only minimization and client-only filtering cannot establish authorization.
TRADE-OFFS: Fail-closed legacy resources need recreation; global locking reduces throughput; conservative ambiguous-parent handling can hide otherwise useful records.
FAILURE MODES: Missing scope blocks access; revoked sources disappear; infrastructure outages remain service failures; concurrent reassignment and free-text privacy remain explicit follow-up work.
HSE VALUE: Operational evidence and critical decisions stay within the responsible user's authorized projects, with human control of safety-critical approval.
TURING VALUE: Demonstrable safeguards, injected hermetic tests, explicit contracts and candid boundaries rather than claims of unrestricted agent knowledge.
