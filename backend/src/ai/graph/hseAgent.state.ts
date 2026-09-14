import { operationalPresentationFactsSchema } from './operationalPresentationFacts';
import { z } from 'zod';
import { AgentStatus, AgentErrorCode, RefusalCode } from './hseAgent.types';
import { MAX_HISTORY_TURNS } from '../config';
import { EvidenceAuthority, EvidenceSourceType, VerificationStatus } from './evidence.contract';

const ragEvidenceSchema = z.object({
  chunkId: z.string(), documentId: z.string(), content: z.string(), score: z.number(),
  semanticRank: z.number().int().positive().optional(), lexicalRank: z.number().int().positive().optional(), fusionScore: z.number().optional(),
  sourceId: z.string(), title: z.string(), module: z.string(), version: z.string(),
  citationLabel: z.string(), sourceOrganization: z.string(), jurisdiction: z.string(), sourceUrl: z.string(),
});

const evidenceFactSchema = z.object({ path: z.string(), value: z.union([z.string(), z.number(), z.boolean(), z.null()]) });
const agentEvidenceSchema = z.object({
  id: z.string(), sourceType: z.enum([EvidenceSourceType.TOOL, EvidenceSourceType.RAG]), source: z.string(),
  authority: z.enum([EvidenceAuthority.OPERATIONAL, EvidenceAuthority.APPROVED_KNOWLEDGE]),
  toolName: z.string().optional(), resultStatus: z.enum(['SUCCESS_WITH_DATA', 'SUCCESS_NO_DATA', 'ERROR']).optional(),
  recordCount: z.number().int().min(0).optional(), facts: z.array(evidenceFactSchema).max(1000).optional(),
  rag: z.object({ chunkId:z.string(),documentId:z.string(),sourceId:z.string(),citationLabel:z.string(),jurisdiction:z.string(),content:z.string(),version:z.string().optional(),sourceUrl:z.string().optional(),sourceOrganization:z.string().optional() }).optional(),
});
const verificationResultSchema = z.object({
  status: z.enum([VerificationStatus.VERIFIED,VerificationStatus.PARTIALLY_VERIFIED,VerificationStatus.INSUFFICIENT_EVIDENCE,VerificationStatus.CONTRADICTED,VerificationStatus.SAFETY_BLOCKED]),
  claimsConsidered:z.number().int().min(0),verifiedClaims:z.number().int().min(0),unsupportedClaims:z.number().int().min(0),
  evidenceItemsConsidered:z.number().int().min(0),evidenceSourceTypes:z.array(z.enum([EvidenceSourceType.TOOL,EvidenceSourceType.RAG])),
  sources:z.array(z.string()),reasons:z.array(z.string()),
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
    presentationFacts: operationalPresentationFactsSchema.optional(),
    resultStatus: z.enum(['SUCCESS_WITH_DATA', 'SUCCESS_NO_DATA']).optional(),
  })).default([]),
  ragUsed: z.boolean().default(false),
  /** Deterministic per-turn requirement; generated text and verification cannot clear it. */
  requiresHumanApproval: z.boolean().default(false),
  retrievalDiagnostics: z.object({ retrievalMode: z.enum(['HYBRID', 'SEMANTIC_ONLY', 'LEXICAL_FALLBACK']), relevanceState: z.string(), reformulationStatus: z.string(), configFingerprint: z.string() }).optional(),
  ragStatus: z.enum(['OK', 'NO_RELEVANT_EVIDENCE', 'RETRIEVAL_UNAVAILABLE', 'PARTIAL_REQUIRED_EVIDENCE', 'NOT_APPROPRIATE', 'NOT_USED', 'ERROR']).default('NOT_USED'),
  ragEvidence: z.array(ragEvidenceSchema).default([]),
  evidence: z.array(agentEvidenceSchema).default([]),
  verificationResult: verificationResultSchema.optional(),
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
      AgentErrorCode.AUTHORIZATION_DENIED,
      AgentErrorCode.PROJECT_SCOPE_DENIED,
      AgentErrorCode.RESOURCE_OWNERSHIP_DENIED,
      AgentErrorCode.RESOURCE_NOT_FOUND,
      AgentErrorCode.PROVIDER_UNAVAILABLE,
      AgentErrorCode.EMPTY_ANSWER,
      AgentErrorCode.STEP_LIMIT,
      AgentErrorCode.TOOL_FAILURE,
      AgentErrorCode.MODEL_ERROR,
      AgentErrorCode.TIMEOUT,
      AgentErrorCode.RAG_GROUNDING,
      AgentErrorCode.HITL_PERSISTENCE,
      AgentErrorCode.SEMANTIC_VERIFICATION,
    ])
    .optional(),
});

export type HseAgentState = z.infer<typeof hseAgentStateSchema>;
