import { z } from 'zod';
import { AgentStatus, AgentErrorCode, RefusalCode } from './hseAgent.types';
import { MAX_HISTORY_TURNS } from '../config';

const ragEvidenceSchema = z.object({
  chunkId: z.string(), documentId: z.string(), content: z.string(), score: z.number(),
  sourceId: z.string(), title: z.string(), module: z.string(), version: z.string(),
  citationLabel: z.string(), sourceOrganization: z.string(), jurisdiction: z.string(), sourceUrl: z.string(),
});

/**
 * Graph state. Must stay JSON-serialisable: no model handles, no pg clients, no
 * callbacks — those live in AgentRuntime and are passed through config.configurable.
 * API keys never appear here, and neither does the system prompt.
 */
export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const hseAgentStateSchema = z.object({
  /** UUID identifying this single run. */
  runId: z.string().uuid(),
  /** Groups runs belonging to the same conversation. */
  conversationId: z.string().uuid(),
  /** Conversation so far, already trimmed by the runner. */
  messages: z.array(chatTurnSchema).max(MAX_HISTORY_TURNS + 1).default([]),
  status: z
    .enum([
      AgentStatus.RECEIVED,
      AgentStatus.AUTHORIZED,
      AgentStatus.PROCESSING,
      AgentStatus.TOOL_EXECUTED,
      AgentStatus.VERIFIED,
      AgentStatus.COMPLETED,
      AgentStatus.REFUSED,
      AgentStatus.FAILED,
      AgentStatus.AWAITING_HUMAN_APPROVAL,
    ])
    .default(AgentStatus.RECEIVED),
  /** Model round-trips consumed. Bounded by MAX_AGENT_STEPS. */
  stepCount: z.number().int().min(0).default(0),
  /** Tool names only — never arguments or results, which may carry HSE data. */
  toolNames: z.array(z.string()).default([]),
  executedRoute: z.array(z.string()).default([]),
  toolTrace: z.array(z.object({
    name: z.string(),
    status: z.enum(['COMPLETED', 'ERROR', 'NOT_OBSERVABLE']),
    arguments: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    resultSummary: z.string().optional(),
  })).default([]),
  ragUsed: z.boolean().default(false),
  ragStatus: z.enum(['OK', 'NO_RELEVANT_EVIDENCE', 'NOT_APPROPRIATE', 'NOT_USED', 'ERROR']).default('NOT_USED'),
  ragEvidence: z.array(ragEvidenceSchema).default([]),
  finalText: z.string().default(''),
  approvalRequest: z.object({
    approvalId: z.string().uuid(), threadId: z.string().uuid(), actionType: z.literal('LOTO_SAFETY_EXECUTION'),
    summary: z.string(), reason: z.string(), riskLevel: z.literal('CRITICAL'),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']), requestedAt: z.string(),
    resolvedAt: z.string().optional(), resolutionNote: z.string().optional(),
  }).optional(),
  refusalReason: z
    .enum([RefusalCode.EMPTY_INPUT, RefusalCode.TOO_LONG, RefusalCode.PROMPT_INJECTION, RefusalCode.OUT_OF_SCOPE, RefusalCode.SECRET_MEMORY_REJECTION, RefusalCode.SENSITIVE_MEMORY_REJECTION, RefusalCode.GENERIC_SAFETY_REJECTION])
    .optional(),
  errorCode: z
    .enum([
      AgentErrorCode.PROVIDER_UNAVAILABLE,
      AgentErrorCode.EMPTY_ANSWER,
      AgentErrorCode.STEP_LIMIT,
      AgentErrorCode.TOOL_FAILURE,
      AgentErrorCode.MODEL_ERROR,
      AgentErrorCode.TIMEOUT,
      AgentErrorCode.RAG_GROUNDING,
      AgentErrorCode.HITL_PERSISTENCE,
    ])
    .optional(),
});

export type HseAgentState = z.infer<typeof hseAgentStateSchema>;
