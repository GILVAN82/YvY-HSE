import { AgentStatus, type AgentToolTrace, type AgentStatus as TechnicalAgentStatus } from './graph/hseAgent.types';

export const ResponseStatus = {
  SUCCESS: 'SUCCESS', NO_DATA: 'NO_DATA', ERROR: 'ERROR', PENDING: 'PENDING',
  APPROVED: 'APPROVED', REJECTED: 'REJECTED', REFUSED: 'REFUSED',
} as const;

export type ResponseStatus = (typeof ResponseStatus)[keyof typeof ResponseStatus];

/**
 * Backwards-compatible public semantics layered over technical graph state:
 * COMPLETED -> SUCCESS/NO_DATA, FAILED -> ERROR, AWAITING_HUMAN_APPROVAL -> PENDING,
 * resolved HITL -> APPROVED/REJECTED, and guard refusal -> REFUSED.
 */
export function resolveResponseStatus(input: {
  status: TechnicalAgentStatus | string;
  errorCode?: string;
  approvalStatus?: string;
  tools?: AgentToolTrace[];
  ragStatus?: string;
}): ResponseStatus {
  if (input.approvalStatus === 'APPROVED') return ResponseStatus.APPROVED;
  if (input.approvalStatus === 'REJECTED') return ResponseStatus.REJECTED;
  if (input.status === AgentStatus.REFUSED) return ResponseStatus.REFUSED;
  if (input.status === AgentStatus.FAILED || input.errorCode || (input.ragStatus === 'ERROR' || input.ragStatus === 'RETRIEVAL_UNAVAILABLE') || input.tools?.some((tool) => tool.status === 'ERROR')) return ResponseStatus.ERROR;
  if (input.status === AgentStatus.AWAITING_HUMAN_APPROVAL || input.approvalStatus === 'PENDING') return ResponseStatus.PENDING;
  if ((input.ragStatus === 'NO_RELEVANT_EVIDENCE' || input.ragStatus === 'PARTIAL_REQUIRED_EVIDENCE') || input.tools?.some((tool) => tool.resultStatus === 'SUCCESS_NO_DATA')) return ResponseStatus.NO_DATA;
  return ResponseStatus.SUCCESS;
}
