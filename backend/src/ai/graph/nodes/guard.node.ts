import type { HseAgentState } from '../hseAgent.state';
import { AgentStatus, RefusalCode } from '../hseAgent.types';
import { MAX_MESSAGE_LENGTH } from '../../config';
import { classifyExplicitMemoryIntent, classifyMemorySafetyRejection } from '../../memory/memory.service';
import type { LangGraphRunnableConfig } from '@langchain/langgraph';
import type { AgentRuntime } from '../hseAgent.types';
import { classifyIntent } from '../../intent/intentRouter';
import { classifyAgentAction } from '../../hitl/hitl.policy';

/**
 * Patterns that try to make the model disclose its instructions or credentials.
 * Deliberately narrow: HSE questions legitimately mention "instruções",
 * "procedimento" and "regras", so only phrasings aimed at the *system* match.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|todas\s+as\s+)?(previous|prior|above|anterior)/i,
  /disregard\s+(all\s+)?(previous|prior|your)\s+(instructions?|rules?)/i,
  /esque[çc][ae]\s+(todas\s+as\s+)?(instru[çc][õo]es|regras)\s+(anteriores|acima)/i,
  /(reveal|show|print|repeat|display)\s+(me\s+)?(your\s+|the\s+)?(system\s+)?prompt/i,
  /(mostre|revele|imprima|repita)\s+(o\s+)?(seu\s+)?(prompt|system\s+prompt)/i,
  /(ignora|omite)\s+(todas\s+las\s+)?(instrucciones|reglas)\s+(anteriores|previas)/i,
  /(muestra|revela|imprime|repite)\s+(tu\s+|el\s+)?(prompt|prompt\s+del\s+sistema)/i,
  /\b(api[_\s-]?key|secret[_\s-]?key|access[_\s-]?token|senha\s+do\s+sistema)\b/i,
  /\b(env|environment)\s+(var|variable|vari[áa]ve[li])/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /(a\s+partir\s+de\s+agora|agora)\s+voc[êe]\s+[ée]\s+(um|uma)\b/i,
  /\bDAN\s+mode\b|\bjailbreak\b/i,
];

const HSE_SCOPE_PATTERN = /\b(hse|qhse|safety|health|environment|environmental|seguranca|saude|ambiente|kpi|trir|ltifr|project|projects|projeto|projetos|portfolio|incident|incidents|incidente|incidentes|action|actions|acao|acoes|loto|lockout|tagout|ptw|permit|permissao|risk|risks|risco|riscos|emergency|emergencia|audit|auditoria|inspection|inspecao|training|treinamento|formacao|ppe|epi|hazard|perigo|compliance|man-hours|dashboard|sistema|system|procedimento|procedimentos|procedure|procedures|instrucao|instrucoes|instructions|manpower|prj-\d+)\b/i;
const CONTEXTUAL_FOLLOW_UP_PATTERNS: RegExp[] = [
  /^(qual|quais|which)\s+(delas|deles|desses|dessas|one|ones|of them)\b/i,
  /^(e|and)\s+(depois|then|agora|now|who|quem)\b/i,
  /^(continue|continuar|continua|prossiga|go on)\b/i,
  /\b(afterward|afterwards|after that|next step|depois disso|proximo passo)\b/i,
  /^(what|e|and)\s+(happens|acontece|about|sobre).*(that|isso|after|depois|next|proximo)\b/i,
  /^(and|e).*(verify|verifies|verificar|verifica).*(isolation|isolamento)\b/i,
];

const OBVIOUS_OUT_OF_SCOPE_PATTERN = /\b(president|presidente|prime minister|capital of|capital de|weather|clima|tempo hoje|forecast|previsao do tempo|poem|poema|recipe|receita|football|futebol|election|eleicao)\b/i;
function normalized(message: string): string {
  return message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export interface GuardDecision {
  allowed: boolean;
  reason?: (typeof RefusalCode)[keyof typeof RefusalCode];
}

export function isInScopeInput(message: string): boolean {
  return HSE_SCOPE_PATTERN.test(normalized(message ?? ''));
}

export function isAttachmentContextRequest(message: string, attachmentContext?: string): boolean {
  return Boolean(attachmentContext)
    && HSE_SCOPE_PATTERN.test(normalized(attachmentContext!))
    && /\b(analy[sz]e|review|document|file|attachment|spreadsheet|image|this|it|documento|arquivo|anexo|planilha|imagem|isto)\b/i.test(message);
}

export function isContextualFollowUp(message: string): boolean {
  const plain = normalized((message ?? '').trim());
  return !OBVIOUS_OUT_OF_SCOPE_PATTERN.test(plain)
    && CONTEXTUAL_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(plain));
}

export type ScopeClassification = 'IN_SCOPE' | 'IN_SCOPE_MEMORY_COMMAND' | 'IN_SCOPE_CONTEXTUAL_FOLLOWUP' | 'OUT_OF_SCOPE';

export function classifyScopeWithThreadContext(message: string, priorMessages: Array<{ role: 'user' | 'assistant'; content: string }>): ScopeClassification {
  if (classifyExplicitMemoryIntent(message)) return 'IN_SCOPE_MEMORY_COMMAND';
  const routed = classifyIntent(message);
  if (routed.scope === 'OUT_OF_SCOPE') return 'OUT_OF_SCOPE';
  if (routed.candidateTools.length || isInScopeInput(message)) return 'IN_SCOPE';
  if (!isContextualFollowUp(message)) return 'OUT_OF_SCOPE';
  const antecedent = [...priorMessages].reverse().find((turn) => turn.role === 'user');
  return antecedent && isInScopeInput(antecedent.content) ? 'IN_SCOPE_CONTEXTUAL_FOLLOWUP' : 'OUT_OF_SCOPE';
}

/** Pure predicate — exported so it can be unit-tested without building a graph. */
export function inspectInput(message: string): GuardDecision {
  const text = (message ?? '').trim();
  if (!text) return { allowed: false, reason: RefusalCode.EMPTY_INPUT };
  if (text.length > MAX_MESSAGE_LENGTH) return { allowed: false, reason: RefusalCode.TOO_LONG };
  const memorySafetyRejection = classifyMemorySafetyRejection(text);
  if (memorySafetyRejection === 'SECRET_OR_CREDENTIAL') return { allowed: false, reason: RefusalCode.SECRET_MEMORY_REJECTION };
  if (memorySafetyRejection === 'SENSITIVE_PERSONAL_DATA') return { allowed: false, reason: RefusalCode.SENSITIVE_MEMORY_REJECTION };
  if (INJECTION_PATTERNS.some((p) => p.test(text))) {
    return { allowed: false, reason: RefusalCode.PROMPT_INJECTION };
  }
  if (classifyExplicitMemoryIntent(text)) return { allowed: true };
  if (classifyIntent(text).scope === 'OUT_OF_SCOPE') return { allowed: false, reason: RefusalCode.OUT_OF_SCOPE };
  return { allowed: true };
}

/**
 * First node of the graph. Validates the latest user turn and either authorises the
 * run or marks it refused. Never calls the model, so a refusal costs nothing.
 */
export async function guardNode(state: HseAgentState, config?: LangGraphRunnableConfig): Promise<Partial<HseAgentState>> {
  const last = [...state.messages].reverse().find((m) => m.role === 'user');
  const decision = inspectInput(last?.content ?? '');

  if (!decision.allowed) {
    const runtime = config?.configurable?.runtime as AgentRuntime | undefined;
    const attachmentScopedInput = isAttachmentContextRequest(last?.content ?? '', runtime?.attachmentContext);
    if (attachmentScopedInput) return { status: AgentStatus.AUTHORIZED, executedRoute: [...state.executedRoute, 'guard'] };
    const earlierTurns = state.messages.filter((m) => m !== last);
    if (classifyScopeWithThreadContext(last?.content ?? '', earlierTurns) === 'IN_SCOPE_CONTEXTUAL_FOLLOWUP') {
      return { status: AgentStatus.AUTHORIZED, executedRoute: [...state.executedRoute, 'guard'] };
    }
    return { status: AgentStatus.REFUSED, refusalReason: decision.reason, executedRoute: [...state.executedRoute, 'guard'] };
  }
  return { status: AgentStatus.AUTHORIZED, requiresHumanApproval:classifyAgentAction(last?.content??'',state.messages.filter(m=>m!==last))==='CRITICAL_APPROVAL', executedRoute: [...state.executedRoute, 'guard'] };
}
