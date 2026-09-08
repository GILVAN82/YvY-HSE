# YvY operational overview

Broad workplace questions such as “What is pending?” and “O que temos em aberto?” route to `OPERATIONAL_OVERVIEW`. The route exposes only the existing read-only operational sources: overdue actions, incidents and portfolio KPIs. Project authorization remains inside each tool. A successful empty query is `SUCCESS_NO_DATA`; it is never presented as a retrieval failure. If one source is unavailable, the other successful sections remain usable.

The user-facing response leads with priorities and exceptions. The screen keeps the concise response, one business card per consulted source and expandable evidence. Voice uses the existing spoken-response formatter, so it reads a short summary instead of tables, record IDs or technical trace data. Tool names, graph nodes, candidate tools and confidence remain in Agent Inspector.

YvY remains a **state-graph / workflow agent**:

`Guard → Agent / Tool Calling → Verification → Approval Gate → Finalization`

This pattern was chosen because deterministic transitions, explicit verification and explicit HITL make safety behavior easier to audit. ReAct supports freer reasoning/action loops and is useful for exploration, but is less predictable. Plan-and-execute creates an explicit plan for long multi-step work, adding complexity that routine HSE queries do not need. The state graph keeps the existing controlled safety flow while still allowing bounded multi-tool execution.

## Short demo

1. Tool calling: ask “What is pending?” and show the overview cards and evidence.
2. RAG grounding: ask “What does the approved LOTO guidance require?” and show its approved citation.
3. Memory: ask a short same-thread follow-up about the prior result.
4. HITL: request critical LOTO execution approval and show the approval gate.

The operational benefit is a single view of overdue work, recent incident records and portfolio indicators. It helps an HSE user prioritize exceptions and open the underlying register without implying capabilities, statuses or controls that the available evidence does not establish.
