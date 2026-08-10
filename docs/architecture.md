# YVY HSE System Architecture

## Overview

YVY HSE is a local full-stack HSE/QHSE application with an Angular frontend,
an Express and TypeScript backend, PostgreSQL operational storage and a
LangGraph-based AI Agent.

```text
Angular application
    │
    ├── Operational REST API ──→ PostgreSQL HSE tables
    │
    └── AI chat API
            │
            └── LangGraph
                 guard → agent → verify → approval gate → finalize
                    │        │                  │
                    │        ├── read-only SQL tools
                    │        └── approved-source RAG / pgvector
                    ├── PostgreSQL thread state and explicit memory
                    └── PostgreSQL human approval records
```

## Frontend

The Angular 18 application provides portfolio and project dashboards,
metadata-driven operational registers and a floating AI chat widget. English
is the default interface language. Localized resource dictionaries support the
additional languages exposed by the language selector.

## Backend

The Express API exposes operational routes, KPI calculations and the
controlled AI endpoint. Table metadata defines reusable register behavior and
avoids duplicated controllers. Values in SQL queries are parameterized.

## Agent orchestration

The LangGraph workflow applies domain and security checks before execution,
observes model and tool steps, verifies the result and enters the human
approval gate when a critical action is detected. The agent cannot bypass or
self-resolve that gate.

## Operational tools and RAG

Structured, current and exact data is retrieved through five read-only
PostgreSQL tools. Semantic retrieval is reserved for approved HSE documents.
The RAG collection contains four approved sources and four embedded chunks
using 1536-dimensional vectors.

## State, memory and HITL

- `agent_thread_state` stores isolated conversation state.
- `agent_long_term_memory` stores only explicit, policy-compliant memory.
- `agent_human_approval` stores pending and resolved human decisions.
- Critical LOTO requests use the `LOTO_SAFETY_EXECUTION` action type and cannot
  be approved autonomously.

## Configuration and security

Secrets are loaded from `backend/.env`, which is ignored by Git. Provider and
model choices are validated by server-side allowlists. Controlled error
responses prevent exposure of stack traces, SQL, filesystem paths, raw provider
payloads, API keys and system prompts.

## Demo isolation

The synthetic demo database is `hse_app_demo`. Demo startup validates the
actual PostgreSQL connection with `SELECT current_database()` and fails closed
when the database is not the expected demo database or when port 3000 is
already occupied.
