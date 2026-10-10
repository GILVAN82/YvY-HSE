# Safe Repository Structure

```text
hse-system-app/
├── frontend/                 Angular application and AI chat widget
├── backend/src/
│   ├── ai/
│   │   ├── graph/            LangGraph state, runner and nodes
│   │   ├── rag/              source registry, ingestion and retrieval
│   │   ├── memory/           controlled long-term memory
│   │   ├── hitl/             human approval policy and persistence
│   │   └── evaluation/       Agent Harness dataset and reports
│   ├── routes/               Express API and SSE boundary
│   └── db/                   centralized PostgreSQL access
├── database/
│   ├── migrations/           pgvector, thread, memory and HITL tables
│   └── validate-*.js         non-destructive integrity checks
├── knowledge/approved/       four reviewed RAG summaries
├── artifacts/evaluation/     safe JSON/Markdown evaluation reports
├── artifacts/presentation/   final evidence, diagrams and reports
└── docs/                     architecture, Sprint evidence and presentation
```

Excluded: `.env`, dependency trees, credentials, backup contents and generated build output.
