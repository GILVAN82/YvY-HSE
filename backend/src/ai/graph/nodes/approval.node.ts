import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { HseAgentState } from '../hseAgent.state';
import { AgentErrorCode, AgentStatus, type AgentRuntime } from '../hseAgent.types';
import { classifyAgentAction } from '../../hitl/hitl.policy';

export async function approvalGateNode(state: HseAgentState, config: LangGraphRunnableConfig): Promise<Partial<HseAgentState>> {
  const userMessage = [...state.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  if (classifyAgentAction(userMessage) !== 'CRITICAL_APPROVAL') return { status: AgentStatus.VERIFIED };
  const runtime = config.configurable?.runtime as AgentRuntime | undefined;
  if (!runtime?.approvalService) return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.HITL_PERSISTENCE };
  try {
    const approvalRequest = await runtime.approvalService.create(state.conversationId, 'LOTO_SAFETY_EXECUTION');
    return { status: AgentStatus.AWAITING_HUMAN_APPROVAL, approvalRequest };
  } catch {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.HITL_PERSISTENCE };
  }
}

export function approvalOutcome(state: HseAgentState): 'pending' | 'continue' | 'failed' {
  if (state.status === AgentStatus.AWAITING_HUMAN_APPROVAL) return 'pending';
  if (state.status === AgentStatus.FAILED) return 'failed';
  return 'continue';
}
