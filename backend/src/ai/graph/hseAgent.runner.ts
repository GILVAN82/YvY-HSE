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

export interface RunAgentInput {
  message: string;
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
  attachmentContext?: string;
  attachments?: NormalizedAttachment[];
  locale?: string;
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
  const runId = randomUUID();
  const conversationId = resolveThreadId(input);
  const responseLanguage = resolveResponseLanguage({ userMessage: input.message, uiLanguage: input.locale });

  // Refuse before loading state or optional services. Out-of-scope input cannot
  // reach the model, RAG, tools, memory or the HITL persistence path.
  const preflight = inspectInput(input.message);
  let persisted = null as Awaited<ReturnType<NonNullable<RunAgentInput['threadStore']>['load']>> | null;
  const attachmentScopedInput = isAttachmentContextRequest(input.message, input.attachmentContext);
  if (!preflight.allowed && !attachmentScopedInput) {
    const contextualCandidate = preflight.reason === 'OUT_OF_SCOPE' && isContextualFollowUp(input.message);
    if (contextualCandidate && input.threadStore) persisted = await input.threadStore.load(conversationId);
    const contextualInScope = contextualCandidate
      && classifyScopeWithThreadContext(input.message, persisted?.messages ?? []) === 'IN_SCOPE_CONTEXTUAL_FOLLOWUP';
    if (!contextualInScope) {
      const refusalReason = preflight.reason!;
      const text = controlledRefusalMessage(refusalReason, input.message, input.locale);
      input.emit({ type: 'text', text });
      return { runId, conversationId, status: AgentStatus.REFUSED, text, toolsUsed: [], stepCount: 0, refusalReason, ragUsed: false, citations: [] };
    }
  }

  if (input.attachmentContext && /\b(remember|save|store|memorize|lembre|guarde|salve|armazene)\b.*\b(document|file|attachment|spreadsheet|image|documento|arquivo|anexo|planilha|imagem|entire|whole|inteiro|completo)\b/i.test(input.message)) {
    const text = ({ en: 'Attachments are temporary and cannot be stored as long-term memory.', pt: 'Os anexos são temporários e não podem ser guardados na memória de longo prazo.', es: 'Los archivos adjuntos son temporales y no pueden guardarse en la memoria a largo plazo.', fr: 'Les pièces jointes sont temporaires et ne peuvent pas être enregistrées dans la mémoire à long terme.', de: 'Anhänge sind temporär und können nicht im Langzeitgedächtnis gespeichert werden.' } as const)[responseLanguage];
    input.emit({ type: 'text', text });
    return { runId, conversationId, status: AgentStatus.REFUSED, text, toolsUsed: [], stepCount: 0, refusalReason: 'OUT_OF_SCOPE', ragUsed: false, citations: [] };
  }

  persisted ??= input.threadStore ? await input.threadStore.load(conversationId) : null;
  const history = (persisted?.messages ?? input.history ?? []).slice(-MAX_HISTORY_TURNS);
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
      console.warn(JSON.stringify({ event: 'long_term_memory_retrieval', status: 'UNAVAILABLE' }));
    }
  }

  try {
    const final = await graph.invoke(
      { runId, conversationId, messages, status: AgentStatus.RECEIVED, stepCount: 0, toolNames: [], ragUsed: false, ragEvidence: [], finalText: '' },
      {
        configurable: {
          runtime: { model: input.model, emit: input.emit, ragRetriever: input.ragRetriever, memoryService: input.memoryService, longTermMemories, allowMemoryWrite, approvalService: input.approvalService, tools: input.tools, attachmentContext: input.attachmentContext, attachments: input.attachments, responseLanguage },
          // Only consulted when a checkpointer is attached.
          thread_id: conversationId,
        },
        // Nodes per run is small and fixed; this only guards against a malformed graph.
        recursionLimit: MAX_AGENT_STEPS * 4,
      }
    );

    const response = {
      runId,
      conversationId,
      status: final.status,
      text: final.finalText,
      toolsUsed: final.toolNames,
      stepCount: final.stepCount,
      refusalReason: final.refusalReason,
      errorCode: final.errorCode,
      ragUsed: final.ragUsed,
      citations: final.ragEvidence.map(({ sourceId, citationLabel, sourceUrl, jurisdiction }) => ({ sourceId, citationLabel, sourceUrl, jurisdiction })),
      approvalRequest: final.approvalRequest,
    };
    if (input.threadStore && (final.status === AgentStatus.COMPLETED || final.status === AgentStatus.AWAITING_HUMAN_APPROVAL)) {
      const sourceReferences = response.citations.length ? response.citations : (persisted?.sourceReferences ?? []);
      await input.threadStore.save({
        threadId: conversationId,
        messages: [...messages, { role: 'assistant', content: response.text }],
        lastRagUsed: response.ragUsed || persisted?.lastRagUsed === true,
        sourceReferences,
      });
    }
    return response;
  } catch (err: any) {
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
      text: '',
      toolsUsed: [],
      stepCount: 0,
      errorCode: AgentErrorCode.MODEL_ERROR,
      ragUsed: false,
      citations: [],
    };
  }
}

export interface ResumeApprovalInput {
  approvalId: string;
  threadId: string;
  decision: HumanDecision;
  resolutionNote?: string;
  approvalService: ApprovalService;
  threadStore?: ThreadStateStore;
  locale?: string;
}

export async function resumeHumanApproval(input: ResumeApprovalInput) {
  if (!UUID.test(input.approvalId) || !UUID.test(input.threadId)) throw new InvalidThreadIdError('approvalId and threadId must be UUIDs');
  const approval = await input.approvalService.resolve(input.approvalId, input.threadId, input.decision, input.resolutionNote);
  const language = resolveResponseLanguage({ uiLanguage: input.locale });
  const text = approval.status === 'APPROVED'
    ? ({ en:'Human approval was recorded for this LOTO safety execution request. The AI did not approve the action.',pt:'A aprovação humana foi registrada para esta solicitação de execução LOTO. A IA não aprovou a ação.',es:'La aprobación humana se registró para esta solicitud de ejecución LOTO. La IA no aprobó la acción.',fr:"L’approbation humaine a été enregistrée pour cette demande d’exécution LOTO. L’IA n’a pas approuvé l’action.",de:'Die menschliche Genehmigung für diese LOTO-Ausführungsanfrage wurde erfasst. Die KI hat die Aktion nicht genehmigt.' } as const)[language]
    : ({ en:'The human decision rejected this LOTO safety execution request. The critical action remains stopped.',pt:'A decisão humana rejeitou esta solicitação de execução LOTO. A ação crítica permanece interrompida.',es:'La decisión humana rechazó esta solicitud de ejecución LOTO. La acción crítica permanece detenida.',fr:"La décision humaine a rejeté cette demande d’exécution LOTO. L’action critique reste interrompue.",de:'Die menschliche Entscheidung hat diese LOTO-Ausführungsanfrage abgelehnt. Die kritische Aktion bleibt gestoppt.' } as const)[language];
  if (input.threadStore) {
    const state = await input.threadStore.load(input.threadId);
    if (state) await input.threadStore.save({ threadId: input.threadId, messages: [...state.messages, { role: 'assistant', content: text }], lastRagUsed: state.lastRagUsed, sourceReferences: state.sourceReferences });
  }
  return { approval, text };
}
