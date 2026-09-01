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
  ├── operational tool evidence
  └── approved RAG evidence
  ↓
semantic verify
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
| `verify` | Validate typed tool/RAG evidence, claim compatibility, citations and HITL safety assertions before any model text is released |
| `approval_gate` | Create or resume a human decision for critical actions |
| `refuse` | Return controlled language-aware refusal semantics |
| `finalize` | Produce safe user-facing completion or controlled error output |

## State and traceability

The graph records safe execution metadata including status, path, step count,
tool names, RAG use, action classification, approval state and a structured
verification result. The Inspector exposes verification status, evidence count,
claim counts, source types and controlled reason codes. Raw evidence, prompts,
secrets, personal data and internal reasoning are not included in the public trace.

## Semantic verification and evidence contracts

The agent node converts every current-run operational result into a typed,
serializable evidence item containing its tool identity, result status,
record count and a bounded set of non-sensitive primitive facts. RAG results
become approved-knowledge evidence with exact chunk, document, source and
citation identities. Memory is deliberately absent from this authoritative
contract: it remains untrusted context and cannot prove current operational or
procedural claims.

The deterministic verifier distinguishes ordinary conversation from claims
that require evidence. It checks zero-result language, numeric compatibility,
tool failures, exact retrieved citations, bounded lexical support in the cited
chunk and statements that misrepresent LOTO approval or physical execution.
Its result is one of `VERIFIED`, `PARTIALLY_VERIFIED`,
`INSUFFICIENT_EVIDENCE`, `CONTRADICTED` or `SAFETY_BLOCKED`.

Model text is buffered inside the agent node. Only `VERIFIED` text is emitted
by finalization (or by the pending approval boundary after verification). Any
other result routes to a localized insufficient-evidence response, so rejected
text cannot leak through the SSE stream before verification finishes.

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

`SUCCESS_NO_DATA` remains a successful operational outcome, but a response that
turns it into a positive record count is classified as `CONTRADICTED`. An
unsupported safety/procedural claim is classified as `SAFETY_BLOCKED` and fails
closed without an invented correction or citation.

## Persistence boundaries

- `agent_thread_state`: short-term conversation state
- `agent_long_term_memory`: explicit and policy-controlled persistent memory
- `agent_human_approval`: critical-action approval lifecycle
- `rag_documents` and `rag_chunks`: approved knowledge and vector embeddings

The agent does not write to the 42 operational HSE tables.
