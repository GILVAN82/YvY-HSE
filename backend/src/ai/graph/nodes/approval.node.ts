import { AuthorizationError } from '../../../auth/authorization';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { HseAgentState } from '../hseAgent.state';
import { AgentErrorCode, AgentStatus, type AgentRuntime } from '../hseAgent.types';
import { classifyAgentAction } from '../../hitl/hitl.policy';

export async function approvalGateNode(state: HseAgentState, config: LangGraphRunnableConfig): Promise<Partial<HseAgentState>> {
  const userMessage = [...state.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const executedRoute = [...state.executedRoute, 'approval_gate'];
  if (classifyAgentAction(userMessage) !== 'CRITICAL_APPROVAL') return { status: AgentStatus.VERIFIED, executedRoute };
  const runtime = config.configurable?.runtime as AgentRuntime | undefined;
  if (!runtime?.approvalService) return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.HITL_PERSISTENCE, executedRoute };
  try {
    const approvalRequest = await runtime.approvalService.create(state.conversationId, 'LOTO_SAFETY_EXECUTION');
    if (state.finalText) runtime.emit({ type:'text', text:state.finalText });
    return { status: AgentStatus.AWAITING_HUMAN_APPROVAL, approvalRequest, executedRoute };
  } catch(error) {
    if(error instanceof AuthorizationError)return {status:AgentStatus.FAILED,errorCode:error.code,finalText:'',executedRoute};
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.HITL_PERSISTENCE, executedRoute };
  }
}

export function approvalOutcome(state: HseAgentState): 'pending' | 'continue' | 'failed' {
  if (state.status === AgentStatus.AWAITING_HUMAN_APPROVAL) return 'pending';
  if (state.status === AgentStatus.FAILED) return 'failed';
  return 'continue';
}
