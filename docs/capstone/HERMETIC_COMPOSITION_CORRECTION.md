> **HISTORICAL / VERSIONED SPRINT EVIDENCE.** Preserve the measurements and source baseline below. The current consolidated authority is [Sprint H](SPRINT_H_FINAL_COMPLIANCE.md), [test strategy](TEST_STRATEGY.md), [requirements](TURING_REQUIREMENTS_MATRIX.md) and [review matrix](REVIEW_COMPLIANCE_MATRIX.md). Earlier counts, line numbers, readiness decisions and pending items are not current claims. No old live result validates the current model/prompt baseline.

# YvY HSE Hermetic Composition Correction

## Problem

The normal backend suite passed locally, but a fresh-copy run without `.env` or `DATABASE_URL` failed while importing the authorization tests. This contradicted the known requirement that default `npm test` must not need live PostgreSQL or local secrets.

## Reproduction

An isolated copy was created with source code, static migrations, the approved knowledge corpus, and installed dependencies, but no `.env`, database URL, provider keys, or network configuration. The baseline failed before executing `authorization.test.ts`:

```text
authorization.test.ts → routes/kpi.ts → db/pool.ts
→ requireDatabaseUrl() → Database configuration is required
```

The first diagnostic copies also proved that static migrations and the approved corpus are required test fixtures, not external services. All temporary copies were removed.

## Root Cause

`computeKpi` accepted an optional database argument but lived in `routes/kpi.ts`, which imported the production `pool`. The default argument referenced that pool. Merely importing the reusable function therefore initialized production database configuration before a fake executor could be supplied.

## Missed Dependency Path

Sprint 1.1 correctly introduced explicit production composition for the agent runner, tools, thread state, memory, RAG, and HITL. It missed the later authorization regression path importing `computeKpi` from the route module. The fake database was passed at call time, but the eager module import occurred earlier.

## Corrective Architecture

```text
Reusable KPI service
  → explicit KpiQueryExecutor (required)

Production HTTP boundary
  → createKpiRouter(pool)

Production AI composition
  → computeKpi(..., pool)

Tests
  → computeKpi(..., fakeExecutor)
```

`kpi.service.ts` has no production pool or environment import. `kpi.ts` is a router factory and is also safe to import without configuration. Production still imports `db/pool.ts` from `index.ts` and `productionDependencies.ts`, so missing `DATABASE_URL` remains fail-closed.

## Files Changed

- `backend/src/routes/kpi.service.ts` — extracted reusable KPI calculation with required executor.
- `backend/src/routes/kpi.ts` — changed to injected router factory.
- `backend/src/index.ts` — binds the real pool to the production KPI router.
- `backend/src/ai/productionDependencies.ts` — binds the real pool to the Agent `get_kpi` capability.
- `backend/src/auth/__tests__/authorization.test.ts` — imports the configuration-free service; authorization assertions unchanged.
- `backend/src/routes/__tests__/kpi.hermetic.test.ts` — import-time regression without DB/provider configuration.
- `docs/capstone/FINAL_CAPSTONE_REQUIREMENTS_AUDIT.md` — blocker closure and updated decision.

## Regression Test

The new test starts a child Node process after removing `DATABASE_URL`, provider API keys, and provider configuration variables. It imports both the reusable KPI service and router. Any future eager pool/environment dependency makes the child process fail.

Existing authorization coverage still proves that scoped users aggregate only their allowed projects and that ADMIN all-project authority remains explicit. Existing Agent tests preserve the `get_kpi` tool contract, bounded tool loop, response envelopes, and semantic states.

## Hermetic Validation

- Test files: 23
- Tests: 233
- Suites: 46
- Passed: 233
- Failed: 0
- `.env` present: no
- `DATABASE_URL` present: no
- Provider keys present: no
- PostgreSQL required/contacted: no
- Provider network required/contacted: no

The clean temporary copy was deleted after validation.

## Production Validation

- Backend typecheck: PASS
- Backend build: PASS
- Existing production backend with valid local configuration restarted and returned `/api/health` HTTP 200.
- The KPI route remains behind authentication (`401` without a session).
- Production `pool` is explicitly passed by `index.ts` and `productionDependencies.ts`.
- `requireDatabaseUrl({})` still throws; no fallback or test-only production behavior was added.

## Jochen Feedback Closure

- Default `npm test` without live PostgreSQL: **CLOSED**.
- Fake DB/dependency injection in the affected runner/tool/KPI path: **CLOSED**.

The correction records the full engineering sequence: audit → isolated reproduction → import-chain root cause → explicit composition → regression prevention.

## Remaining Limitations

The official Project rubric is still unavailable in the repository, so authoritative rubric compliance cannot be claimed. This is an evidence-source uncertainty, not an application defect. Existing product limitations documented in the final audit remain unchanged.
