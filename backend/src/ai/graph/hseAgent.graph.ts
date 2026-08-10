import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';
import { hseAgentStateSchema } from './hseAgent.state';
import { AgentStatus } from './hseAgent.types';
import { guardNode } from './nodes/guard.node';
import { agentNode } from './nodes/agent.node';
import { verifyNode, verifyOutcome } from './nodes/verify.node';
import { finalizeNode, finalizeFailureNode } from './nodes/finalize.node';
import { refuseNode } from './nodes/refuse.node';
import { approvalGateNode, approvalOutcome } from './nodes/approval.node';

/**
 * Agent control flow.
 *
 *   START → guard ─ refused ─→ refuse ──────────────→ END
 *                 └ allowed ─→ agent → verify ─ valid ──→ finalize        → END
 *                                            └ invalid ─→ finalize_failure → END
 *
 * LangGraph owns states and transitions; the Vercel AI SDK owns the provider call,
 * streaming and tool execution inside the `agent` node. The two are complementary,
 * not alternatives — see docs/langgraph-architecture.md.
 */
export function buildHseAgentGraph(options: { checkpointer?: MemorySaver } = {}) {
  const graph = new StateGraph(hseAgentStateSchema)
    .addNode('guard', guardNode)
    .addNode('agent', agentNode)
    .addNode('verify', verifyNode)
    .addNode('approval_gate', approvalGateNode)
    .addNode('finalize', finalizeNode)
    .addNode('finalize_failure', finalizeFailureNode)
    .addNode('refuse', refuseNode)
    .addEdge(START, 'guard')
    .addConditionalEdges(
      'guard',
      (state) => (state.status === AgentStatus.REFUSED ? 'refused' : 'allowed'),
      { refused: 'refuse', allowed: 'agent' }
    )
    .addEdge('agent', 'verify')
    .addConditionalEdges('verify', verifyOutcome, {
      valid: 'approval_gate',
      invalid: 'finalize_failure',
    })
    .addConditionalEdges('approval_gate', approvalOutcome, {
      pending: END,
      continue: 'finalize',
      failed: 'finalize_failure',
    })
    .addEdge('finalize', END)
    .addEdge('finalize_failure', END)
    .addEdge('refuse', END);

  return graph.compile({ checkpointer: options.checkpointer });
}

/**
 * In-memory checkpointer, for local development and tests only.
 *
 * VOLATILE: state lives in the process heap. It does not survive a restart, is not
 * shared between instances, and provides no conversation persistence or resumability.
 * A Postgres checkpointer is a later phase — see docs/limitations.md.
 */
export function createDevCheckpointer(): MemorySaver {
  return new MemorySaver();
}
