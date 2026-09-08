import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, AgentErrorCode, type AgentRuntime } from '../hseAgent.types';
import { MAX_AGENT_STEPS } from '../../config';
import { VerificationStatus } from '../evidence.contract';
import { verifyEvidenceContract } from '../semanticVerifier';

/**
 * Checks the run produced something usable. Deliberately does NOT call the model a
 * second time in this phase — it is a cheap structural check, not a semantic one.
 * Grounding and citation checks belong to the RAG phase.
 */
const evidenceLimitedMessage={en:"I found operational information, but I couldn't verify the full summary. The available evidence is on screen.",pt:'Encontrei informações operacionais, mas não consegui verificar todo o resumo. As evidências disponíveis estão na tela.',es:'Encontré información operativa, pero no pude verificar todo el resumen. La evidencia disponible está en pantalla.',fr:"J’ai trouvé des informations opérationnelles, mais je n’ai pas pu vérifier l’ensemble du résumé. Les preuves disponibles sont à l’écran.",de:'Ich habe Betriebsinformationen gefunden, konnte die vollständige Zusammenfassung jedoch nicht verifizieren. Die verfügbaren Nachweise werden angezeigt.'} as const;

export async function verifyNode(state: HseAgentState, config?:LangGraphRunnableConfig): Promise<Partial<HseAgentState>> {
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
  const hasUsableOperationalEvidence=state.evidence.some(item=>item.sourceType==='TOOL'&&(item.resultStatus==='SUCCESS_WITH_DATA'||item.resultStatus==='SUCCESS_NO_DATA'));
  if (hasUsableOperationalEvidence&&(verificationResult.status===VerificationStatus.PARTIALLY_VERIFIED||verificationResult.status===VerificationStatus.INSUFFICIENT_EVIDENCE)) {
    const runtime=config?.configurable?.runtime as AgentRuntime|undefined;
    return {status:AgentStatus.VERIFIED,verificationResult,finalText:evidenceLimitedMessage[runtime?.responseLanguage??'en'],executedRoute};
  }
  if (verificationResult.status !== VerificationStatus.VERIFIED) {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.SEMANTIC_VERIFICATION, verificationResult, executedRoute };
  }

  return { status: AgentStatus.VERIFIED, verificationResult, executedRoute };
}

/** Edge predicate: which finalizer to route to. */
export function verifyOutcome(state: HseAgentState): 'valid' | 'invalid' {
  return state.status === AgentStatus.VERIFIED ? 'valid' : 'invalid';
}
