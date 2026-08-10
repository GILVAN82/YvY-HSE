import { randomUUID } from 'node:crypto';
import { streamText, stepCountIs, type LanguageModel, type ModelMessage } from 'ai';
import { hseTools } from './tools';
import { SYSTEM_PROMPT } from './prompt';
import { MAX_AGENT_STEPS, MAX_HISTORY_TURNS, MODEL_TIMEOUT_MS } from './config';
import { inspectInput } from './graph/nodes/guard.node';
import { controlledRefusalMessage } from './graph/nodes/refuse.node';
import {
  AgentStatus,
  AgentErrorCode,
  RefusalCode,
  type AgentRunResult,
  type EmitFn,
} from './graph/hseAgent.types';
import type { ChatTurn } from './graph/hseAgent.state';

const REFUSAL_MESSAGES: Record<string, string> = {
  [RefusalCode.EMPTY_INPUT]: 'Please send a question so I can help.',
  [RefusalCode.TOO_LONG]: 'This message is too long. Summarize the question and try again.',
  [RefusalCode.PROMPT_INJECTION]:
    'I can only answer questions about HSE system data. I can help with KPIs, incidents, actions or projects.',
};

/**
 * The pre-LangGraph flow, kept behind AI_ORCHESTRATOR=legacy so the two orchestrators
 * can be compared side by side. It carries the same P0 fixes as the graph path —
 * `stopWhen` closing the agentic loop, the corrected tool SQL and the input guard —
 * so any behavioural difference comes from orchestration, not from stale bugs.
 */
export async function runLegacyAgent(input: {
  message: string;
  history?: ChatTurn[];
  conversationId?: string;
  model: LanguageModel;
  emit: EmitFn;
}): Promise<AgentRunResult> {
  const runId = randomUUID();
  const conversationId = input.conversationId ?? randomUUID();

  const decision = inspectInput(input.message);
  if (!decision.allowed) {
    const reason = decision.reason ?? RefusalCode.EMPTY_INPUT;
    const message = controlledRefusalMessage(reason, input.message);
    input.emit({ type: 'text', text: message });
    return {
      runId,
      conversationId,
      status: AgentStatus.REFUSED,
      text: message,
      toolsUsed: [],
      stepCount: 0,
      refusalReason: reason,
    };
  }

  const history = (input.history ?? []).slice(-MAX_HISTORY_TURNS);
  const messages: ModelMessage[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as ModelMessage),
    { role: 'user', content: input.message },
  ];

  const toolsUsed: string[] = [];
  let text = '';
  let steps = 0;

  try {
    const result = streamText({
      model: input.model,
      system: SYSTEM_PROMPT,
      tools: hseTools,
      messages,
      maxOutputTokens: 4096,
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
      timeout: MODEL_TIMEOUT_MS,
    });

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        text += part.text;
        input.emit({ type: 'text', text: part.text });
      } else if (part.type === 'tool-call') {
        toolsUsed.push(part.toolName);
        input.emit({ type: 'tool_use', name: part.toolName });
      } else if (part.type === 'finish-step') {
        steps += 1;
      } else if (part.type === 'error') {
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }
  } catch (err: any) {
    const timedOut = /timeout|aborted/i.test(err?.message ?? '');
    const code = timedOut ? AgentErrorCode.TIMEOUT : AgentErrorCode.MODEL_ERROR;
    input.emit({ type: 'error', message: 'I could not complete this query right now.', code });
    return { runId, conversationId, status: AgentStatus.FAILED, text, toolsUsed, stepCount: steps, errorCode: code };
  }

  if (!text.trim()) {
    input.emit({
      type: 'error',
      message: 'I could not produce an answer for this question.',
      code: AgentErrorCode.EMPTY_ANSWER,
    });
    return {
      runId,
      conversationId,
      status: AgentStatus.FAILED,
      text,
      toolsUsed,
      stepCount: steps,
      errorCode: AgentErrorCode.EMPTY_ANSWER,
    };
  }

  return { runId, conversationId, status: AgentStatus.COMPLETED, text, toolsUsed, stepCount: steps };
}
