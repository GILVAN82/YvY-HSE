import { buildEvidencePresentation } from './evidencePresentation';
import { withExecution, currentExecution, timed, logEvent, observeFailure } from '../observability/context';
import { DomainError } from '../observability/errors';
import { PROMPT_REGISTRY } from '../prompts/composer';
import { setAgentLogContext } from '../../auth/access-log';
import { randomUUID } from 'node:crypto';
import type { LanguageModel, ToolSet } from 'ai';
import { buildHseAgentGraph, createDevCheckpointer } from './hseAgent.graph';
import type { ChatTurn } from './hseAgent.state';
import {
  AgentStatus,
  AgentErrorCode,
  type AgentRunResult,
  type EmitFn,
} from './hseAgent.types';
import { MAX_AGENT_STEPS, MAX_HISTORY_TURNS } from '../config';
import type { RagRetriever } from '../rag/retrieval.types';
import type { ThreadStateStore } from './threadState.repository';
import { hasExplicitMemoryIntent } from '../memory/memory.service';
import type { MemoryService } from '../memory/memory.types';
import type { ApprovalService, HumanDecision } from '../hitl/hitl.types';
import { classifyScopeWithThreadContext, inspectInput, isAttachmentContextRequest, isContextualFollowUp } from './nodes/guard.node';
import { controlledRefusalMessage } from './nodes/refuse.node';
import type { NormalizedAttachment } from '../attachments/attachment.types';
import { resolveResponseLanguage } from '../responseLanguage';
import { resolveResponseStatus } from '../responseStatus';
import { classifyIntent, clarificationMessage } from '../intent/intentRouter';
import { contextualGreeting } from '../personalization';

export interface RunAgentInput {
  /** Server/test diagnostic sink; never read from request JSON. */
  diagnosticSink?: (event: import('../observability/context').SafeEvent) => void;
  message: string;
  /** Trusted server-derived owner; never accepted from the chat request body. */
  userId?: string;
  history?: ChatTurn[];
  conversationId?: string;
  /** Stable checkpoint lookup key. conversationId remains a backwards-compatible alias. */
  threadId?: string;
  model: LanguageModel;
  emit: EmitFn;
  /** Dev/test only. Volatile — see createDevCheckpointer(). */
  useCheckpointer?: boolean;
  ragRetriever?: RagRetriever;
  threadStore?: ThreadStateStore;
  memoryService?: MemoryService;
  approvalService?: ApprovalService;
  tools?: ToolSet;
  toolFactory?: (allowMemoryWrite: boolean) => ToolSet;
  attachmentContext?: string;
  attachments?: NormalizedAttachment[];
  locale?: string;
  /** Per-turn language detected from voice input. It never changes saved preferences. */
  voiceLanguage?: string;
  /** Trusted first name derived from the authenticated principal at the HTTP boundary. */
  authenticatedFirstName?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InvalidThreadIdError extends Error {}

export function resolveThreadId(input: Pick<RunAgentInput, 'threadId' | 'conversationId'>): string {
  if (input.threadId && input.conversationId && input.threadId !== input.conversationId) {
    throw new InvalidThreadIdError('threadId and conversationId must identify the same thread');
  }
  const value = input.threadId ?? input.conversationId ?? randomUUID();
  if (!UUID.test(value)) throw new InvalidThreadIdError('threadId must be a UUID');
  return value;
}

/** Compiled once: building the graph per request would waste work on every message. */
let compiled: ReturnType<typeof buildHseAgentGraph> | null = null;
let compiledWithCheckpointer: ReturnType<typeof buildHseAgentGraph> | null = null;

function getGraph(useCheckpointer: boolean) {
  if (useCheckpointer) {
    compiledWithCheckpointer ??= buildHseAgentGraph({ checkpointer: createDevCheckpointer() });
    return compiledWithCheckpointer;
  }
  compiled ??= buildHseAgentGraph();
  return compiled;
}

/** Test seam: forces the next call to rebuild the graph. */
export function resetGraphCache() {
  compiled = null;
  compiledWithCheckpointer = null;
}

/**
 * Single entry point for the LangGraph orchestrator.
 *
 * Owns run identity, history trimming, recursion limit and error mapping, so the HTTP
 * layer only has to translate the result into SSE — the same events the legacy path
 * emits, keeping the Angular contract unchanged.
 */
export async function runHseAgent(input: RunAgentInput): Promise<AgentRunResult> {
  const runId = randomUUID(), threadId = resolveThreadId(input);
  return withExecution({ runId, threadId, userId: input.userId, startedAt: Date.now(), locale: input.locale }, async () => {
    const observation = currentExecution()!.observation;
    observation.prompt = PROMPT_REGISTRY.agent;
    if (typeof input.model === 'object') { observation.provider = input.model.provider; observation.model = input.model.modelId; }
    logEvent('run_started', 'runner');
    const result = await timed('runner', () => runHseAgentInContext(input, runId, threadId));
    if (result.errorCode && !observation.error) {
      const category = /DENIED|RESOURCE_NOT_FOUND/.test(result.errorCode) ? 'AUTHORIZATION' : /HITL/.test(result.errorCode) ? 'HITL' : /TOOL/.test(result.errorCode) ? 'TOOL' : 'INTERNAL';
      observeFailure(new DomainError(category, result.errorCode, false), 'runner');
    }
    if (result.status === AgentStatus.AWAITING_HUMAN_APPROVAL) logEvent('hitl_pending', 'approval_gate');
    if (result.executionTrace) {
      result.executionTrace.observability = { ...observation, stages: [...observation.stages] };
      // Inspector receives technical metadata, never request text or operational tool arguments.
      delete result.executionTrace.authenticatedUser;
      if (result.executionTrace.intent) { result.executionTrace.intent.input = ''; result.executionTrace.intent.normalizedQuery = ''; }
      result.executionTrace.tools = result.executionTrace.tools.map(({ arguments: args, resultSummary, ...tool }) => ({ ...tool, arguments: args ? Object.fromEntries(Object.entries(args).filter(([,value]) => typeof value === 'boolean' || typeof value === 'number')) : undefined, resultSummary: resultSummary && /^(?:\d+(?: projects found| incidents? found| total incidents; \d+ open| record\(s\) returned)|No open incidents)$/.test(resultSummary) ? resultSummary : tool.status }));
    }
    logEvent('run_finished', 'runner', { durationMs: Date.now() - currentExecution()!.context.startedAt });
    return result;
  }, input.diagnosticSink);
}

async function runHseAgentInContext(input: RunAgentInput, runId: string, conversationId: string): Promise<AgentRunResult> {
  // Direct unit-test callers historically had no HTTP principal. Production always
  // supplies userId at the authenticated route boundary.
  const ownerId = input.userId ?? '00000000-0000-4000-8000-000000000000';
  setAgentLogContext(runId,conversationId);
  const executionTimestamp = new Date().toISOString();
  const responseLanguage = resolveResponseLanguage({ userMessage: input.message, voiceLanguage: input.voiceLanguage, uiLanguage: input.locale });

  // Refuse before loading state or optional services. Out-of-scope input cannot
  // reach the model, RAG, tools, memory or the HITL persistence path.
  const preflight = inspectInput(input.message);
  let persisted = null as Awaited<ReturnType<NonNullable<RunAgentInput['threadStore']>['load']>> | null;
  const attachmentScopedInput = isAttachmentContextRequest(input.message, input.attachmentContext);
  if (!preflight.allowed && !attachmentScopedInput) {
    const contextualCandidate = preflight.reason === 'OUT_OF_SCOPE' && isContextualFollowUp(input.message);
    if (contextualCandidate && input.threadStore) persisted = await input.threadStore.load(conversationId, ownerId);
    const contextualInScope = contextualCandidate
      && classifyScopeWithThreadContext(input.message, persisted?.messages ?? []) === 'IN_SCOPE_CONTEXTUAL_FOLLOWUP';
    if (!contextualInScope) {
      const refusalReason = preflight.reason!;
      const text = controlledRefusalMessage(refusalReason, input.message, input.locale);
      input.emit({ type: 'text', text });
      return { runId, conversationId, status: AgentStatus.REFUSED, responseStatus: 'REFUSED', text, toolsUsed: [], stepCount: 0, refusalReason, ragUsed: false, citations: [], executionTrace: {
        timestamp: executionTimestamp, responseLanguage, authenticatedUser:input.authenticatedFirstName, route: ['guard', 'refuse'], tools: [],
        rag: { used: false, status: 'NOT_USED', chunksRetrieved: 0 },
        conversation: { stateActive: false, messageCount: 0 },
        memory: { used: false, operation: 'NONE', categories: [], status: 'NOT_USED' },
        guardrail: { status: 'REFUSED', reason: refusalReason },
        verification: { status:'VERIFIED',claimsConsidered:0,verifiedClaims:0,unsupportedClaims:0,evidenceItemsConsidered:0,evidenceSourceTypes:[],sources:[],reasons:[] },
      } };
    }
  }

  if (input.attachmentContext && /\b(remember|save|store|memorize|lembre|guarde|salve|armazene)\b.*\b(document|file|attachment|spreadsheet|image|documento|arquivo|anexo|planilha|imagem|entire|whole|inteiro|completo)\b/i.test(input.message)) {
    const text = ({ en: 'Attachments are temporary and cannot be stored as long-term memory.', pt: 'Os anexos são temporários e não podem ser guardados na memória de longo prazo.', es: 'Los archivos adjuntos son temporales y no pueden guardarse en la memoria a largo plazo.', fr: 'Les pièces jointes sont temporaires et ne peuvent pas être enregistrées dans la mémoire à long terme.', de: 'Anhänge sind temporär und können nicht im Langzeitgedächtnis gespeichert werden.' } as const)[responseLanguage];
    input.emit({ type: 'text', text });
    return { runId, conversationId, status: AgentStatus.REFUSED, responseStatus: 'REFUSED', text, toolsUsed: [], stepCount: 0, refusalReason: 'OUT_OF_SCOPE', ragUsed: false, citations: [], executionTrace: {
      timestamp: executionTimestamp, responseLanguage, authenticatedUser:input.authenticatedFirstName, route: ['guard', 'refuse'], tools: [],
      rag: { used: false, status: 'NOT_USED', chunksRetrieved: 0 },
      conversation: { stateActive: false, messageCount: 0 },
      memory: { used: false, operation: 'NONE', categories: [], status: 'NOT_USED' },
      guardrail: { status: 'REFUSED', reason: 'OUT_OF_SCOPE' },
      verification: { status:'VERIFIED',claimsConsidered:0,verifiedClaims:0,unsupportedClaims:0,evidenceItemsConsidered:0,evidenceSourceTypes:[],sources:[],reasons:[] },
    } };
  }

  persisted ??= input.threadStore ? await input.threadStore.load(conversationId, ownerId) : null;
  const history = (persisted?.messages ?? input.history ?? []).slice(-MAX_HISTORY_TURNS);
  const firstInteraction = history.length === 0;
  const intentDecision = classifyIntent(input.message, history);
  if (intentDecision.scope === 'OUT_OF_SCOPE' || (intentDecision.clarificationRequired && intentDecision.intent === 'OPERATIONAL_ATTENTION')) {
    const refused = intentDecision.scope === 'OUT_OF_SCOPE';
    const text = refused ? controlledRefusalMessage('OUT_OF_SCOPE', input.message, input.locale) : clarificationMessage(input.locale);
    input.emit({ type: 'text', text });
    return {
      runId, conversationId, status: refused ? AgentStatus.REFUSED : AgentStatus.COMPLETED,
      responseStatus: refused ? 'REFUSED' : 'SUCCESS', text, toolsUsed: [], stepCount: 0,
      ...(refused ? { refusalReason: 'OUT_OF_SCOPE' as const } : {}), ragUsed: false, citations: [],
      executionTrace: { timestamp: executionTimestamp, responseLanguage, authenticatedUser:input.authenticatedFirstName, route: ['guard', refused ? 'refuse' : 'clarify'], tools: [],
        rag: { used: false, status: 'NOT_USED', chunksRetrieved: 0 }, conversation: { stateActive: false, messageCount: history.length + 1 },
        memory: { used: false, operation: 'NONE', categories: [], status: 'NOT_USED' },
        guardrail: { status: refused ? 'REFUSED' : 'PASS', ...(refused ? { reason: 'OUT_OF_SCOPE' as const } : {}) },
        intent: { ...intentDecision },
        verification: { status:'VERIFIED',claimsConsidered:0,verifiedClaims:0,unsupportedClaims:0,evidenceItemsConsidered:0,evidenceSourceTypes:[],sources:[],reasons:[] },
      },
    };
  }
  const messages: ChatTurn[] = [...history, { role: 'user', content: input.message }];

  const graph = getGraph(!!input.useCheckpointer);
  const allowMemoryWrite = hasExplicitMemoryIntent(input.message);
  let longTermMemories = [] as Awaited<ReturnType<NonNullable<RunAgentInput['memoryService']>['retrieveRelevant']>>;
  if (input.memoryService) {
    try {
      longTermMemories = await input.memoryService.retrieveRelevant(input.message);
    } catch {
      // Long-term memory is optional context. Fail open without leaking internals;
      // thread state, RAG and the agent remain usable.
      logEvent('memory_unavailable', 'memory', { level: 'warn', errorCategory: 'DATABASE', recoverable: true });
    }
  }

  try {
    const final = await graph.invoke(
      { runId, conversationId, messages, status: AgentStatus.RECEIVED, stepCount: 0, toolNames: [], executedRoute: [], toolTrace: [], ragUsed: false, ragStatus: 'NOT_USED', ragEvidence: [], evidence: [], finalText: '' },
      {
        configurable: {
          runtime: { model: input.model, emit: input.emit, ragRetriever: input.ragRetriever, memoryService: input.memoryService, longTermMemories, allowMemoryWrite, approvalService: input.approvalService, tools: input.tools, toolFactory: input.toolFactory, attachmentContext: input.attachmentContext, attachments: input.attachments, responseLanguage, intentDecision, authenticatedFirstName:input.authenticatedFirstName, firstInteraction, contextualGreeting:contextualGreeting(responseLanguage,input.authenticatedFirstName) },
          // Only consulted when a checkpointer is attached.
          thread_id: conversationId,
        },
        // Nodes per run is small and fixed; this only guards against a malformed graph.
        recursionLimit: MAX_AGENT_STEPS * 4,
      }
    );

    const memoryTool = final.toolNames.find((name) => name === 'save_memory' || name === 'forget_memory');
    const memoryOperation = memoryTool === 'save_memory' ? 'WRITE' : memoryTool === 'forget_memory' ? 'FORGET' : longTermMemories.length ? 'READ' : 'NONE';
    const citations = final.ragEvidence.map(({ sourceId, citationLabel, sourceUrl, jurisdiction }) => ({ sourceId, citationLabel, sourceUrl, jurisdiction }));
    const response: AgentRunResult = {
      evidencePresentation: buildEvidencePresentation(final.evidence, final.toolTrace, final.ragEvidence, executionTimestamp),
      runId,
      conversationId,
      status: final.status,
      responseStatus: resolveResponseStatus({ status: final.status, errorCode: final.errorCode, approvalStatus: final.approvalRequest?.status, tools: final.toolTrace, ragStatus: final.ragStatus }),
      text: final.finalText,
      toolsUsed: final.toolNames,
      stepCount: final.stepCount,
      refusalReason: final.refusalReason,
      errorCode: final.errorCode,
      ragUsed: final.ragUsed,
      citations,
      approvalRequest: final.approvalRequest,
      executionTrace: {
        timestamp: executionTimestamp,
        responseLanguage,
        authenticatedUser: input.authenticatedFirstName,
        route: final.executedRoute,
        tools: final.toolTrace,
        rag: { used: final.ragUsed, status: final.ragStatus, chunksRetrieved: final.ragEvidence.length, diagnostics: final.retrievalDiagnostics },
        conversation: {
          stateActive: Boolean(input.threadStore && (final.status === AgentStatus.COMPLETED || final.status === AgentStatus.AWAITING_HUMAN_APPROVAL)),
          messageCount: messages.length + ((final.status === AgentStatus.COMPLETED || final.status === AgentStatus.AWAITING_HUMAN_APPROVAL) ? 1 : 0),
        },
        memory: {
          used: memoryOperation !== 'NONE', operation: memoryOperation,
          categories: [...new Set(longTermMemories.map((memory) => memory.category))],
          status: memoryTool ? (final.errorCode === AgentErrorCode.TOOL_FAILURE ? 'ERROR' : 'COMPLETED') : longTermMemories.length ? 'USED' : input.memoryService ? 'NO_MATCH' : 'NOT_USED',
        },
        guardrail: { status: final.status === AgentStatus.REFUSED ? 'REFUSED' : 'PASS', ...(final.refusalReason ? { reason: final.refusalReason } : {}) },
        intent: { ...intentDecision, selectedTool: final.toolNames[0], selectedTools: final.toolNames },
        verification: final.verificationResult ?? { status:'INSUFFICIENT_EVIDENCE',claimsConsidered:0,verifiedClaims:0,unsupportedClaims:0,evidenceItemsConsidered:final.evidence.length,evidenceSourceTypes:[],sources:[],reasons:['Verification did not complete.'] },
        ...(final.errorCode ? { error: { category: final.errorCode, node: final.executedRoute.at(-1) ?? 'unknown', recoverable: final.errorCode !== AgentErrorCode.HITL_PERSISTENCE } } : {}),
      },
    };
    if (input.threadStore && (final.status === AgentStatus.COMPLETED || final.status === AgentStatus.AWAITING_HUMAN_APPROVAL)) {
      const sourceReferences = citations.length ? citations : (persisted?.sourceReferences ?? []);
      await input.threadStore.save({
        threadId: conversationId,
        userId: ownerId,
        messages: [...messages, { role: 'assistant', content: response.text }],
        lastRagUsed: response.ragUsed || persisted?.lastRagUsed === true,
        sourceReferences,
      });
    }
    return response;
  } catch (err: any) {
    observeFailure(err, 'runner');
    // The graph itself failed (not the model) — nodes already convert model and tool
    // errors into states, so reaching here means something structural went wrong.
    input.emit({
      type: 'error',
      message: 'Não consegui concluir essa consulta agora.',
      code: AgentErrorCode.MODEL_ERROR,
    });
    return {
      runId,
      conversationId,
      status: AgentStatus.FAILED,
      responseStatus: 'ERROR',
      text: '',
      toolsUsed: [],
      stepCount: 0,
      errorCode: AgentErrorCode.MODEL_ERROR,
      ragUsed: false,
      citations: [],
      executionTrace: {
        timestamp: executionTimestamp, responseLanguage, authenticatedUser:input.authenticatedFirstName, route: ['guard', 'agent'], tools: [],
        rag: { used: false, status: 'NOT_USED', chunksRetrieved: 0 },
        conversation: { stateActive: false, messageCount: messages.length },
        memory: { used: longTermMemories.length > 0, operation: longTermMemories.length ? 'READ' : 'NONE', categories: [...new Set(longTermMemories.map((memory) => memory.category))], status: longTermMemories.length ? 'USED' : input.memoryService ? 'NO_MATCH' : 'NOT_USED' },
        guardrail: { status: 'PASS' },
        verification: { status:'INSUFFICIENT_EVIDENCE',claimsConsidered:0,verifiedClaims:0,unsupportedClaims:0,evidenceItemsConsidered:0,evidenceSourceTypes:[],sources:[],reasons:['Verification did not complete.'] },
        error: { category: AgentErrorCode.MODEL_ERROR, node: 'agent', recoverable: true },
      },
    };
  }
}

export interface ResumeApprovalInput {
  approvalId: string;
  threadId: string;
  userId?: string;
  decision: HumanDecision;
  resolutionNote?: string;
  approvalService: ApprovalService;
  threadStore?: ThreadStateStore;
  locale?: string;
}

export async function resumeHumanApproval(input: ResumeApprovalInput) {
  if (!UUID.test(input.approvalId) || !UUID.test(input.threadId)) throw new InvalidThreadIdError('approvalId and threadId must be UUIDs');
  const approval = await input.approvalService.resolve(input.approvalId, input.threadId, input.decision, input.resolutionNote, input.userId);
  const language = resolveResponseLanguage({ uiLanguage: input.locale });
  const text = approval.status === 'APPROVED'
    ? ({ en:'Human approval has been recorded. The critical LOTO workflow may proceed to the next authorized verification step. Field verification by competent personnel is still required before execution or re-energization.',pt:'A aprovação humana foi registrada. O fluxo crítico de LOTO pode seguir para a próxima etapa de verificação autorizada. A verificação em campo por pessoal competente continua obrigatória antes da execução ou reenergização.',es:'La aprobación humana ha sido registrada. El flujo crítico de LOTO puede continuar al siguiente paso de verificación autorizado. La verificación en campo por personal competente sigue siendo obligatoria antes de la ejecución o reenergización.',fr:"L’approbation humaine a été enregistrée. Le processus LOTO critique peut passer à l’étape de vérification autorisée suivante. Une vérification sur le terrain par du personnel compétent reste obligatoire avant toute exécution ou remise sous tension.",de:'Die menschliche Genehmigung wurde erfasst. Der kritische LOTO-Ablauf darf mit dem nächsten autorisierten Prüfschritt fortfahren. Vor Ausführung oder Wiedereinschaltung ist weiterhin eine Vor-Ort-Prüfung durch befähigtes Personal erforderlich.' } as const)[language]
    : ({ en:'Human approval was rejected. The critical LOTO action remains blocked and must not proceed.',pt:'A aprovação humana foi rejeitada. A ação crítica de LOTO permanece bloqueada e não deve prosseguir.',es:'La aprobación humana fue rechazada. La acción crítica de LOTO permanece bloqueada y no debe continuar.',fr:"L’approbation humaine a été rejetée. L’action LOTO critique reste bloquée et ne doit pas se poursuivre.",de:'Die menschliche Genehmigung wurde abgelehnt. Die kritische LOTO-Maßnahme bleibt gesperrt und darf nicht fortgesetzt werden.' } as const)[language];
  if (input.threadStore && input.userId) {
    const state = await input.threadStore.load(input.threadId, input.userId);
    if (state) await input.threadStore.save({ threadId: input.threadId, userId: input.userId, messages: [...state.messages, { role: 'assistant', content: text }], lastRagUsed: state.lastRagUsed, sourceReferences: state.sourceReferences });
  }
  return { approval, text, responseStatus: resolveResponseStatus({ status: AgentStatus.COMPLETED, approvalStatus: approval.status }) };
}
