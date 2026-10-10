# Approved YVY HSE knowledge sources

`knowledge/approved/` is the controlled staging location for real, reviewed YVY HSE reference
documents intended for the RAG index.

## What belongs here

- Real YVY HSE procedures, policies, work instructions and reference guidance.
- Only non-sensitive internal reference knowledge while authentication, RBAC, tenant isolation
  and row-level security are unavailable.
- Initially, Markdown (`.md`) and plain-text (`.txt`) files only.

## What does not belong here

- Operational database exports, incidents, investigations, worker/contractor records or metrics.
- Names, contact details, medical information or sensitive operational narratives.
- Passwords, API keys, environment files, connection strings or other secrets.
- Fabricated procedures, copied regulations, arbitrary web content or prompt/system rules.

## Approval and registration

Placing a file in `approved/` does **not** approve or ingest it. A reviewer must add one explicit
entry to `RAG_SOURCE_REGISTRY` in `backend/src/ai/rag/sourceRegistry.ts`, including its stable
source ID, title, module, source type, version, relative file path, sensitivity, enabled state,
citation label and any real effective/revision dates. Unregistered files are ignored; the loader
never scans the directory.

Review source ownership, accuracy, sensitivity and revision before enabling the entry. Only
`public-reference` is currently eligible. A registry entry that is missing, empty, outside this
directory, unsupported, sensitive or secret-bearing is blocked before embedding.

## Preview

Run from `backend/`:

```powershell
npm run rag:ingest -- --dry-run
```

The preview reports approved, excluded, invalid and sensitive sources plus prompt-injection
warnings, hashes, sizes and expected chunks. It does not call OpenAI or mutate PostgreSQL.
