# LangGraph Agent Architecture

## Why LangGraph

LangGraph provides an explicit and inspectable workflow around model execution.
It separates safety checks, reasoning, verification, human approval and final
response handling into named nodes instead of relying on one opaque model call.

The AI SDK remains responsible for provider integration, typed tool calling and
multi-step model execution. LangGraph controls the product workflow around that
execution.

## Graph flow

```text
START
  ↓
guard ── refusal condition ──→ refuse → END
  ↓
agent
  ↓
verify
  ├── controlled failure ──→ finalize → END
  ├── critical action ─────→ approval_gate
  │                              ├── pending → END
  │                              └── resolved → finalize → END
  └── normal completion ──→ finalize → END
```

## Node responsibilities

| Node | Responsibility |
|---|---|
| `guard` | Enforce domain scope, prompt-injection rules and sensitive-memory policy before execution |
| `agent` | Classify the request and execute the model, operational tools or RAG path |
| `verify` | Validate completion state, tool failures, evidence and critical-action classification |
| `approval_gate` | Create or resume a human decision for critical actions |
| `refuse` | Return controlled language-aware refusal semantics |
| `finalize` | Produce safe user-facing completion or controlled error output |

## State and traceability

The graph records safe execution metadata including status, path, step count,
tool names, RAG use, action classification and approval state. Tool arguments,
raw results, prompts, secrets and unrestricted operational data are not included
in the public trace.

Conversation state is persisted in PostgreSQL by thread. Independent thread IDs
remain isolated, and the UI starts a new thread after 15 minutes of inactivity or
when the user selects **New conversation**.

## Routing policy

- Exact current operational questions use read-only PostgreSQL tools.
- Approved procedures and reference questions use RAG.
- Out-of-scope questions are refused before model, RAG, tools or HITL execution.
- Critical LOTO execution requests enter HITL even when RAG has no relevant
  evidence.
- The AI cannot self-approve or resolve a pending critical action.

## Failure handling

Model, tool, validation and no-data outcomes use controlled categories. Public
responses never include provider payloads, stack traces, SQL, prompts, API keys
or filesystem paths.

## Persistence boundaries

- `agent_thread_state`: short-term conversation state
- `agent_long_term_memory`: explicit and policy-controlled persistent memory
- `agent_human_approval`: critical-action approval lifecycle
- `rag_documents` and `rag_chunks`: approved knowledge and vector embeddings

The agent does not write to the 42 operational HSE tables.
