import type { LanguageModel, ToolSet } from 'ai';
import type { RagEvidence, RagRetriever } from '../rag/retrieval.types';
import type { LongTermMemory, MemoryService } from '../memory/memory.types';
import type { ApprovalRequest, ApprovalService } from '../hitl/hitl.types';
import type { NormalizedAttachment } from '../attachments/attachment.types';
import type { ResponseLanguage } from '../responseLanguage';
import type { ResponseStatus } from '../responseStatus';
import type { AgentEvidence, VerificationResult } from './evidence.contract';
import type { IntentDecision } from '../intent/intentRouter';

/** Lifecycle of a single agent run. */
export const AgentStatus = {
  RECEIVED: 'RECEIVED',
  AUTHORIZED: 'AUTHORIZED',
  PROCESSING: 'PROCESSING',
  TOOL_EXECUTED: 'TOOL_EXECUTED',
  VERIFIED: 'VERIFIED',
  COMPLETED: 'COMPLETED',
  REFUSED: 'REFUSED',
  FAILED: 'FAILED',
  AWAITING_HUMAN_APPROVAL: 'AWAITING_HUMAN_APPROVAL',
} as const;

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus];

/** Stable error codes returned to the client. Never leak provider internals. */
export const AgentErrorCode = {
  PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  EMPTY_ANSWER: 'AI_EMPTY_ANSWER',
  STEP_LIMIT: 'AI_STEP_LIMIT_REACHED',
  TOOL_FAILURE: 'AI_TOOL_FAILURE',
  MODEL_ERROR: 'AI_MODEL_ERROR',
  TIMEOUT: 'AI_TIMEOUT',
  RAG_GROUNDING: 'AI_RAG_GROUNDING_FAILED',
  HITL_PERSISTENCE: 'AI_HITL_PERSISTENCE_FAILED',
  SEMANTIC_VERIFICATION: 'AI_SEMANTIC_VERIFICATION_FAILED',
} as const;

export type AgentErrorCode = (typeof AgentErrorCode)[keyof typeof AgentErrorCode];

/** Why the guard turned a request away. Codes only — never the rule text. */
export const RefusalCode = {
  EMPTY_INPUT: 'EMPTY_INPUT',
  TOO_LONG: 'TOO_LONG',
  PROMPT_INJECTION: 'PROMPT_INJECTION',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
  SECRET_MEMORY_REJECTION: 'SECRET_MEMORY_REJECTION',
  SENSITIVE_MEMORY_REJECTION: 'SENSITIVE_MEMORY_REJECTION',
  GENERIC_SAFETY_REJECTION: 'GENERIC_SAFETY_REJECTION',
} as const;

export type RefusalCode = (typeof RefusalCode)[keyof typeof RefusalCode];

/** Events streamed to the browser. Mirrors the SSE contract the Angular widget
 *  already consumes — adding a field is safe, renaming one is not. */
export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string }
  | { type: 'error'; message: string; code?: string };

export type EmitFn = (event: AgentEvent) => void;

export interface AgentToolTrace {
  name: string;
  status: 'COMPLETED' | 'ERROR' | 'NOT_OBSERVABLE';
  arguments?: Record<string, string | number | boolean | null>;
  resultSummary?: string;
  resultStatus?: 'SUCCESS_WITH_DATA' | 'SUCCESS_NO_DATA';
}

export interface AgentExecutionTrace {
  timestamp: string;
  responseLanguage?: ResponseLanguage;
  route: string[];
  tools: AgentToolTrace[];
  rag: {
    used: boolean;
    status: 'OK' | 'NO_RELEVANT_EVIDENCE' | 'NOT_APPROPRIATE' | 'NOT_USED' | 'ERROR';
    chunksRetrieved: number;
  };
  conversation: { stateActive: boolean; messageCount: number };
  memory: {
    used: boolean;
    operation: 'READ' | 'WRITE' | 'FORGET' | 'NONE';
    categories: string[];
    status: 'USED' | 'NO_MATCH' | 'COMPLETED' | 'ERROR' | 'NOT_USED';
  };
  guardrail: { status: 'PASS' | 'BLOCKED' | 'REFUSED'; reason?: RefusalCode };
  intent?: Pick<IntentDecision, 'input' | 'normalizedQuery' | 'scope' | 'confidence' | 'intent' | 'candidateTools' | 'clarificationRequired'> & { selectedTool?: string };
  verification: VerificationResult;
  error?: { category: AgentErrorCode; node: string; recoverable: boolean };
}

/**
 * Everything the graph needs that is not part of the serialisable state.
 * Kept out of the state object so no model handle or callback is ever checkpointed.
 */
export interface AgentRuntime {
  model: LanguageModel;
  emit: EmitFn;
  ragRetriever?: RagRetriever;
  memoryService?: MemoryService;
  longTermMemories?: LongTermMemory[];
  allowMemoryWrite?: boolean;
  approvalService?: ApprovalService;
  attachmentContext?: string;
  attachments?: NormalizedAttachment[];
  responseLanguage?: ResponseLanguage;
  intentDecision?: IntentDecision;
  /** Test/diagnostic seam. Production uses the shared createHseTools registry. */
  tools?: ToolSet;
  toolFactory?: (allowMemoryWrite: boolean) => ToolSet;
}

/** Shape returned by the runner to the HTTP layer. */
export interface AgentRunResult {
  runId: string;
  conversationId: string;
  status: AgentStatus;
  responseStatus?: ResponseStatus;
  text: string;
  toolsUsed: string[];
  stepCount: number;
  refusalReason?: RefusalCode;
  errorCode?: AgentErrorCode;
  ragUsed?: boolean;
  citations?: Pick<RagEvidence, 'sourceId' | 'citationLabel' | 'sourceUrl' | 'jurisdiction'>[];
  approvalRequest?: ApprovalRequest;
  executionTrace?: AgentExecutionTrace;
}

export type { AgentEvidence, VerificationResult };
