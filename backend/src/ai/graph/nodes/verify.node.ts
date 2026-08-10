import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, AgentErrorCode } from '../hseAgent.types';
import { MAX_AGENT_STEPS } from '../../config';

/**
 * Checks the run produced something usable. Deliberately does NOT call the model a
 * second time in this phase — it is a cheap structural check, not a semantic one.
 * Grounding and citation checks belong to the RAG phase.
 */
export async function verifyNode(state: HseAgentState): Promise<Partial<HseAgentState>> {
  // A failure recorded upstream stays a failure.
  if (state.status === AgentStatus.FAILED) return { status: AgentStatus.FAILED };

  if (state.stepCount > MAX_AGENT_STEPS) {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.STEP_LIMIT };
  }

  if (!state.finalText.trim()) {
    // The exact symptom the missing stopWhen used to produce: tools ran, no answer.
    return {
      status: AgentStatus.FAILED,
      errorCode: state.errorCode ?? AgentErrorCode.EMPTY_ANSWER,
    };
  }

  if (state.ragUsed && state.ragEvidence.length) {
    const traceable = state.ragEvidence.every((item) => item.chunkId && item.documentId && item.sourceId && item.citationLabel);
    const citesEvidence = state.ragEvidence.some((item) => state.finalText.includes(`[${item.citationLabel}]`));
    if (!traceable || !citesEvidence) return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.RAG_GROUNDING };
  }

  if (state.ragUsed && !state.ragEvidence.length && /\[(?:OSHA|HSE|ISO|LOTO|PTW)[^\]]*\]/i.test(state.finalText)) {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.RAG_GROUNDING };
  }

  return { status: AgentStatus.VERIFIED };
}

/** Edge predicate: which finalizer to route to. */
export function verifyOutcome(state: HseAgentState): 'valid' | 'invalid' {
  return state.status === AgentStatus.VERIFIED ? 'valid' : 'invalid';
}
