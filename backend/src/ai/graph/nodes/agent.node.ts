import { operationalPresentationFacts } from '../operationalPresentationFacts';
import { stepCountIs, type ModelMessage } from 'ai';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, AgentErrorCode, type AgentRuntime } from '../hseAgent.types';
import { isStructuredOperationalQuery } from '../../rag/retrieval.service';
import type { RagEvidence, RagRetrievalResult } from '../../rag/retrieval.types';
import { buildAgentPrompt } from '../../prompt';
import { validatedModelStream, observedTools } from '../../modelStream';
import { currentExecution } from '../../observability/context';
import { DomainError } from '../../observability/errors';
import { MAX_AGENT_STEPS, MODEL_TIMEOUT_MS } from '../../config';
import type { AgentToolTrace } from '../hseAgent.types';
import { ragResultEvidence, toolResultEvidence, type AgentEvidence } from '../evidence.contract';
import { composeOperationalOverview, operationalPresentationSummary } from '../operationalOverview';
import type { ResponseLanguage } from '../../responseLanguage';

const SAFE_TOOL_ARGUMENTS: Record<string, Set<string>> = {
  get_kpi: new Set(['project', 'month']),
  list_incidents: new Set(['project', 'open', 'limit']),
  list_actions: new Set(['project', 'status', 'open', 'overdue', 'limit']),
  get_projects: new Set(),
  search_hse_knowledge: new Set(['query']),
  save_memory: new Set(['memoryKey', 'category', 'update']),
  forget_memory: new Set(['memoryKey']),
};

function safeToolArguments(toolName: string, input: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const allowed = SAFE_TOOL_ARGUMENTS[toolName];
  if (!allowed) return undefined;
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([key, value]) => allowed.has(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value)))
    .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 160) : value]);
  return entries.length ? Object.fromEntries(entries) as Record<string, string | number | boolean | null> : undefined;
}

export function actionableOverviewArguments(toolName:string,input:unknown):Record<string,unknown>{
  const supplied=input&&typeof input==='object'?input as Record<string,unknown>:{};
  if(toolName==='list_actions')return {...supplied,open:true,overdue:false,limit:20};
  if(toolName==='list_incidents')return {...supplied,open:true,limit:20};
  if(toolName==='get_kpi')return {...supplied,project:'*',month:'*'};
  return supplied;
}

function safeResultSummary(toolName: string, output: unknown, language:ResponseLanguage): string {
  const presentation=operationalPresentationSummary(toolName,output,language);
  if(presentation)return presentation;
  if (Array.isArray(output)) return `${output.length} record(s) returned`;
  if (!output || typeof output !== 'object') return 'Result returned';
  const value = output as Record<string, unknown>;
  if (value.error === true) return 'Controlled tool error';
  if ((value.status === 'SUCCESS_WITH_DATA' || value.status === 'SUCCESS_NO_DATA') && typeof value.recordCount === 'number') {
    return `${value.recordCount} record(s) returned`;
  }
  if (toolName === 'search_hse_knowledge') {
    const count = Array.isArray(value.evidence) ? value.evidence.length : 0;
    return `${String(value.status ?? 'UNKNOWN')}: ${count} chunk(s)`;
  }
  if (toolName === 'save_memory') return `Memory ${String(value.status ?? 'processed').toLowerCase()}`;
  if (toolName === 'forget_memory') return value.forgotten === true ? 'Memory disabled' : 'No matching memory';
  return 'Result returned';
}

export function isAttachmentFocusedQuery(message: string): boolean {
  const asksAboutAttachment = /\b(this|the|attached|uploaded|este|esta|esse|essa|anexad[oa]|enviad[oa])\b.{0,40}\b(document|file|attachment|spreadsheet|image|procedure|documento|arquivo|anexo|planilha|imagem|procedimento)\b|\b(document|file|attachment|spreadsheet|image|documento|arquivo|anexo|planilha|imagem)\b.{0,40}\b(main|summary|summarize|review|analy[sz]e|controls?|hazards?|risks?|resumo|resuma|revise|analise|controles?|perigos?|riscos?)\b/i.test(message);
  const requestsComparison = /\b(compare|contrast|verify against|approved knowledge|knowledge base|rag|comparar|contrastar|verificar com|base de conhecimento)\b/i.test(message);
  return asksAboutAttachment && !requestsComparison;
}

/**
 * The only node that talks to the model. Reuses the existing Vercel AI SDK setup and
 * the shared tool registry — LangGraph owns the control flow, the AI SDK owns the
 * provider call, streaming and tool execution.
 *
 * `stopWhen: stepCountIs(MAX_AGENT_STEPS)` is what closes the agentic loop: without it
 * the SDK defaults to a single step, so a tool call would run and its result would
 * never return to the model, leaving the user with no answer.
 */
export async function agentNode(
  state: HseAgentState,
  config: LangGraphRunnableConfig
): Promise<Partial<HseAgentState>> {
  const runtime = config.configurable?.runtime as AgentRuntime | undefined;
  if (!runtime) {
    return { status: AgentStatus.FAILED, errorCode: AgentErrorCode.MODEL_ERROR };
  }

  const messages: ModelMessage[] = state.messages.map(
    (m) => ({ role: m.role, content: m.content }) as ModelMessage
  );
  const images = runtime.attachments?.filter((attachment) => attachment.kind === 'image') ?? [];
  if (images.length) {
    const latestUserIndex = messages.map((message) => message.role).lastIndexOf('user');
    if (latestUserIndex >= 0) messages[latestUserIndex] = {
      role: 'user',
      content: [
        { type: 'text', text: [...state.messages].reverse().find((message) => message.role === 'user')?.content ?? '' },
        ...images.map((image) => ({ type: 'file' as const, data: image.data, mediaType: image.mimeType, filename: image.filename })),
      ],
    } as ModelMessage;
  }

  const toolNames: string[] = [];
  let text = '';
  let authorizationFailure:AgentErrorCode|undefined;
  let steps = 0;
  let toolFailed = false;
  let toolErrorCount = 0;
  let ragUsed = false;
  let ragEvidence: RagEvidence[] = [];
  let retrievalDiagnostics: HseAgentState['retrievalDiagnostics'];
  let ragStatus: HseAgentState['ragStatus'] = 'NOT_USED';
  const toolTrace: AgentToolTrace[] = [];
  const evidence: AgentEvidence[] = [];
  const allTools = runtime.tools ?? runtime.toolFactory?.(runtime.allowMemoryWrite === true) ?? {};
  const latestUserMessage = [...state.messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const intentTools = runtime.intentDecision?.candidateTools.length && runtime.allowMemoryWrite !== true
    ? Object.fromEntries(Object.entries(allTools).filter(([name]) => runtime.intentDecision!.candidateTools.includes(name))) as typeof allTools
    : allTools;
  const tools = runtime.attachmentContext && isAttachmentFocusedQuery(latestUserMessage)
    ? {} as typeof allTools
    : isStructuredOperationalQuery(latestUserMessage)
    ? Object.fromEntries(Object.entries(intentTools).filter(([name]) => name !== 'search_hse_knowledge')) as typeof allTools
    : intentTools;
  const executionTools=runtime.intentDecision?.intent==='OPERATIONAL_OVERVIEW'
    ? Object.fromEntries(Object.entries(tools).map(([name,definition])=>{const current=definition as any;return [name,current.execute?{...current,execute:(input:unknown,options:unknown)=>current.execute(actionableOverviewArguments(name,input),options)}:current];})) as typeof tools
    : tools;

  try {
    const prompt = buildAgentPrompt(runtime, messages, Object.keys(executionTools));
    const observation = currentExecution()?.observation; if (observation) observation.prompt = prompt.identity;
    const stream = validatedModelStream({
      model: runtime.model,
      ...prompt,
      tools: observedTools(executionTools),
      maxOutputTokens: 4096,
      // Closes the agentic loop: tool results go back to the model for a final answer.
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
      timeout: MODEL_TIMEOUT_MS,
      // The SDK default writes the raw provider error to stderr. Classification
      // and sanitized diagnostics are handled in the catch block below.
      onError: () => undefined,
    });

    for await (const part of stream) {
      switch (part.type) {
        case 'text-delta':
          // Once a tool reports a controlled failure, do not accept or stream a
          // subsequent model guess as operational data.
          if (!toolFailed) {
            // Buffer until deterministic semantic verification succeeds. This prevents
            // an unsupported claim from reaching the SSE client before the verify node.
            text += part.text;
          }
          break;
        case 'tool-call':
          toolNames.push(part.toolName);
          const effectiveInput=runtime.intentDecision?.intent==='OPERATIONAL_OVERVIEW'?actionableOverviewArguments(part.toolName,(part as { input?: unknown }).input):(part as { input?: unknown }).input;
          toolTrace.push({
            name: part.toolName,
            status: 'NOT_OBSERVABLE',
            arguments: safeToolArguments(part.toolName, effectiveInput),
          });
          runtime.emit({ type: 'tool_use', name: part.toolName });
          break;
        case 'tool-result': {
          // Tools never throw — they return {error:true,...} — so surface that as a
          // controlled state rather than letting the run look successful.
          const toolPart = part as { output?: unknown; toolName?: string };
          const output = toolPart.output as ({ error?: boolean } & Partial<RagRetrievalResult>) | undefined;
          const outputRecord = output as Record<string, unknown> | undefined;
          if(typeof outputRecord?.code==='string'&&['AUTHORIZATION_DENIED','PROJECT_SCOPE_DENIED','RESOURCE_OWNERSHIP_DENIED','RESOURCE_NOT_FOUND'].includes(outputRecord.code)){authorizationFailure=outputRecord.code as AgentErrorCode;toolFailed=true;}
          if (output && typeof output === 'object' && output.error === true) {
            toolErrorCount += 1;
            if (runtime.intentDecision?.intent !== 'OPERATIONAL_OVERVIEW') toolFailed = true;
          }
          if (toolPart.toolName) evidence.push(toolResultEvidence(toolPart.toolName, output, evidence.length));
          const pendingTrace = [...toolTrace].reverse().find((item) => item.name === toolPart.toolName && item.status === 'NOT_OBSERVABLE');
          if (pendingTrace) {
            pendingTrace.status = output && typeof output === 'object' && output.error === true ? 'ERROR' : 'COMPLETED';
            pendingTrace.presentationFacts = operationalPresentationFacts(pendingTrace.name, output, pendingTrace.arguments);
            pendingTrace.resultSummary = safeResultSummary(toolPart.toolName ?? pendingTrace.name, output, runtime.responseLanguage??'en');
            if (outputRecord?.status === 'SUCCESS_WITH_DATA' || outputRecord?.status === 'SUCCESS_NO_DATA') pendingTrace.resultStatus = outputRecord.status;
          }
          if (toolPart.toolName === 'search_hse_knowledge') {
            ragUsed = true;
            retrievalDiagnostics = output?.diagnostics;
            ragStatus = output && typeof output.status === 'string' ? output.status : output?.error ? 'ERROR' : 'ERROR';
            if (output?.status === 'OK') {
              ragEvidence = output.evidence as RagEvidence[];
              evidence.push(...ragEvidence.map(ragResultEvidence));
            }
          }
          break;
        }
        case 'finish-step':
          steps += 1;
          break;
        case 'error':
          if (part.error instanceof Error) throw part.error;
          const providerError = new Error('Provider request failed');
          (providerError as Error & { cause?: unknown }).cause = part.error;
          throw providerError;
      }
    }
  } catch (err: any) {
    // Detailed category is retained by the near-provider boundary; wire aliases remain compatible.
    const timedOut = err instanceof DomainError ? err.code === 'MODEL_TIMEOUT' : /timeout|aborted/i.test(err?.message ?? '');
    return {
      status: AgentStatus.FAILED,
      executedRoute: [...state.executedRoute, 'agent'],
      stepCount: steps,
      toolNames,
      toolTrace,
      finalText: text,
      ragUsed,
      ragStatus,
      retrievalDiagnostics,
      ragEvidence,
      evidence,
      errorCode: timedOut ? AgentErrorCode.TIMEOUT : err instanceof DomainError && err.code === 'MODEL_EMPTY_RESPONSE' ? AgentErrorCode.EMPTY_ANSWER : err instanceof DomainError && err.category === 'TOOL' ? AgentErrorCode.TOOL_FAILURE : AgentErrorCode.MODEL_ERROR,
    };
  }

  if(authorizationFailure)return {status:AgentStatus.FAILED,errorCode:authorizationFailure,executedRoute:[...state.executedRoute,'agent'],toolNames,toolTrace,evidence,finalText:''};
  const overviewAllSourcesFailed = runtime.intentDecision?.intent === 'OPERATIONAL_OVERVIEW' && toolNames.length > 0 && toolErrorCount === toolNames.length;
  if(runtime.intentDecision?.intent==='OPERATIONAL_OVERVIEW'&&!overviewAllSourcesFailed){
    text=composeOperationalOverview(evidence,runtime.responseLanguage??'en',runtime.authenticatedFirstName);
  }
  return {
    status: toolNames.length ? AgentStatus.TOOL_EXECUTED : AgentStatus.PROCESSING,
    executedRoute: [...state.executedRoute, 'agent'],
    stepCount: steps,
    toolNames,
    toolTrace,
    finalText: text,
    ragUsed,
    ragStatus,
    retrievalDiagnostics,
    ragEvidence,
    evidence,
    ...(toolFailed || overviewAllSourcesFailed ? { errorCode: AgentErrorCode.TOOL_FAILURE } : {}),
  };
}
