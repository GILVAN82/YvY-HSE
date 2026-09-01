import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, AgentErrorCode } from '../hseAgent.types';
import { MAX_AGENT_STEPS } from '../../config';
import { VerificationStatus } from '../evidence.contract';
import { verifyEvidenceContract } from '../semanticVerifier';

/**
 * Checks the run produced something usable. Deliberately does NOT call the model a
 * second time in this phase — it is a cheap structural check, not a semantic one.
 * Grounding and citation checks belong to the RAG phase.
 */
export async function verifyNode(state: HseAgentState): Promise<Partial<HseAgentState>> {
  const executedRoute = [...state.executedRoute, 'verify'];
  // A failure recorded upstream stays a failure.
  if (state.status === AgentStatus.FAILED) return { status: AgentStatus.FAILED, executedRoute };

  if (state.stepCount > MAX_AGENT_STEPS) {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.STEP_LIMIT, executedRoute };
  }

  if (!state.finalText.trim()) {
    // The exact symptom the missing stopWhen used to produce: tools ran, no answer.
    return {
      status: AgentStatus.FAILED,
      errorCode: state.errorCode ?? AgentErrorCode.EMPTY_ANSWER,
      executedRoute,
    };
  }

  const verificationResult = verifyEvidenceContract(state.finalText, state.evidence);
  if (verificationResult.status !== VerificationStatus.VERIFIED) {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.SEMANTIC_VERIFICATION, verificationResult, executedRoute };
  }

  return { status: AgentStatus.VERIFIED, verificationResult, executedRoute };
}

/** Edge predicate: which finalizer to route to. */
export function verifyOutcome(state: HseAgentState): 'valid' | 'invalid' {
  return state.status === AgentStatus.VERIFIED ? 'valid' : 'invalid';
}
