# YVY HSE Demo Environment

## 1. Purpose

This environment provides a repeatable presentation dataset for the completed YVY HSE application. It changes no product behavior and contains synthetic information only.

## 2. Safety separation

- Normal development database: `hse_app`
- Isolated demonstration database: `hse_app_demo`
- Every demo write verifies `current_database() = 'hse_app_demo'` first.
- A supplied `DEMO_DATABASE_URL` is rejected unless its database name is exactly `hse_app_demo`.
- The reset never writes to, truncates or drops anything in `hse_app`.
- `backend/.env` is read for credentials but is never overwritten.

## 3. Audited modules

| Module | Actual table(s) | Required demo fields | Relationship | Visible in UI | Useful |
|---|---|---|---|---|---|
| Projects/Data Center | `projects` | code, name, type, status, location | project code is shared by operational tables | Yes | Yes |
| Dashboard/KPIs | `manpower_log`, `incident_register`, `action_tracker_capa`, `permit_to_work_register`, `training_competency`, `audit_tracker`, `settings` | dates, project, hours, incident type, status, score | project code | Yes | Yes |
| Actions | `action_tracker_capa` | action ID, source, project, description, priority, target date, status | source reference and project | Yes | Yes |
| Incidents | `incident_register` | incident ID, project, date, type, severity, description | linked action and project | Yes | Yes |
| PTW/LOTO reference | `permit_to_work_register`, `jsa_log` | permit number/type/status, linked JSA, optional LOTO reference | project and JSA ID | Yes | Yes |
| Risk/HIRA | `hira_register` | hazard, controls, risk and residual risk | project and action source reference | Yes | Yes |
| Documents | `document_control` | document ID/name/version/status | project in applicability | Yes | Yes |
| ISO audits | `audit_tracker` | audit ID/type/score/findings | project and action source reference | Yes | Yes |
| Contractors | `contractor_management` | synthetic company, project, approval/rating | project text | Yes | Yes |
| JSA | `jsa_log` | JSA ID, task, permit, status | project and permit | Yes | Yes |
| Long-term state | three `agent_*` tables | none | thread IDs | Not normal data pages | Must start empty |

No dedicated operational LOTO table exists. The demo represents LOTO through a PTW isolation reference and keeps critical approval in the existing HITL flow.

## 4. Demo story

- `DC Lisbon 01`: active electrical work; a near miss leads to the oldest open action, “Review LOTO isolation verification.”
- `DC Madrid 02`: active civil/mechanical work; PTW, housekeeping and manual-handling records provide operational variation.
- `DC Dublin 03`: planning stage; design risk and a future action contrast with active projects.

Names are role labels. Client and contractor values are explicitly synthetic.

## 5. Create and reset

Prerequisites are the normal repository dependencies and a valid PostgreSQL connection in `backend/.env`. The configured database may remain `hse_app`; the demo command derives the same server credentials and replaces only the target database name.

```powershell
cd backend
npm run demo:reset
```

The command creates `hse_app_demo` if absent, verifies the exact target, recreates only its `public` schema, applies `database/schema.sql` and all existing migrations, seeds operational records, ingests the four approved RAG sources and validates the result.

For an explicit connection, set `DEMO_DATABASE_URL` using [`backend/.env.demo.example`](../backend/.env.demo.example) as a template. Do not commit the real value.

Offline operational-only reset is available with `DEMO_SKIP_RAG=1`; it is not presentation-ready until the normal RAG ingestion is run against the demo database.

## 6. Validate

```powershell
cd backend
npm run demo:validate
npm run demo:test
```

Expected counts:

| Metric | Value |
|---|---:|
| Projects | 3 |
| Active Data Center projects | 2 |
| Actions | 12 |
| Overdue actions | 8 |
| Incidents | 5 |
| PTWs | 4 |
| HIRA risks | 4 |
| JSAs | 4 |
| Contractors | 3 |
| Audits | 3 |
| Documents | 3 |
| Training records | 3 |
| RAG documents/chunks | 4 / 4 |

The deterministic oldest overdue action is `DEMO-ACT-001`.

## 7. Start in demo mode

Terminal 1:

```powershell
cd backend
npm run demo:start
```

`demo:start` performs a fail-closed preflight before launching Node. It first checks
port 3000. If another backend is listening, it reports the PID when available and
refuses without killing the process. When the port is free, it connects using the
resolved demo URL, executes `SELECT current_database()`, requires the exact result
`hse_app_demo`, reads the aggregate demo counts and prints the `YVY HSE DEMO MODE`
banner. Only then is the backend process started.

To verify the port, database and banner without leaving a server running, set
`DEMO_PREFLIGHT_ONLY=1` for that invocation.

Terminal 2:

```powershell
cd frontend
npm start
```

Open `http://localhost:4200`. No frontend demo toggle exists; database selection remains an external runtime concern.

## 8. Expected KPI result

The portfolio contains 300,000 man-hours, 5 incidents, 4 recordable incidents and 1 LTI. With `RateBase = 1,000,000`, the existing `computeKpi()` produces:

- TRIR: `13.33`
- LTIFR: `3.33`
- overdue actions: `8`
- current non-overdue open actions: `2`
- active/open PTWs: `2`
- training compliance: `66.67%`
- average audit score: `92`

These values are calculated from source records; no KPI result is hard-coded.

## 9. Recommended AI queries

1. `What is the portfolio TRIR this year?` — expected TRIR approximately `13.33`, with the whole-portfolio assumption stated.
2. `How many active Data Center projects are there?` — expected `2` (`DC Lisbon 01` and `DC Madrid 02`).
3. `Which actions are overdue?` — expected `8` synthetic actions.
4. `Which one is the most overdue?` — expected `DEMO-ACT-001`, “Review LOTO isolation verification.”
5. `What precautions apply before LOTO?` — uses the four-source RAG store, not operational seed data.

## 10. Reset before a presentation

Stop the demo backend, run `npm run demo:reset` from `backend/`, confirm `DEMO DATABASE READY`, then start it with `npm run demo:start`. Reset clears thread state, long-term memory and pending approvals in the demo database.

## 11. Demo-only snapshot

After validation, an optional text-format snapshot can be created explicitly:

```powershell
pg_dump --dbname=hse_app_demo --format=custom --file=yvy-hse-demo.dump
```

Do not run this against `hse_app`, and do not commit the dump.

## 12. Troubleshooting

- `DEMO RESET REFUSED`: confirm the URL ends exactly in `/hse_app_demo`.
- RAG connection failure: restore network access and rerun the reset; operational seed may already exist, but the command intentionally fails until all presentation prerequisites pass.
- Provider unavailable during the demo: verify the normal provider configuration without displaying secrets.
- Port already in use: stop the previous backend/frontend process and retry.

## 13. Return to normal development

Stop `npm run demo:start` and use the ordinary backend command:

```powershell
cd backend
npm run dev
```

This reloads the unchanged `DATABASE_URL` from `backend/.env`, normally pointing to `hse_app`.
