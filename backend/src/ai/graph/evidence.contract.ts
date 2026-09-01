import type { RagEvidence } from '../rag/retrieval.types';

export const EvidenceSourceType = {
  TOOL: 'TOOL',
  RAG: 'RAG',
} as const;
export type EvidenceSourceType = (typeof EvidenceSourceType)[keyof typeof EvidenceSourceType];

export const EvidenceAuthority = {
  OPERATIONAL: 'OPERATIONAL',
  APPROVED_KNOWLEDGE: 'APPROVED_KNOWLEDGE',
} as const;
export type EvidenceAuthority = (typeof EvidenceAuthority)[keyof typeof EvidenceAuthority];

export interface EvidenceFact {
  path: string;
  value: string | number | boolean | null;
}

export interface AgentEvidence {
  id: string;
  sourceType: EvidenceSourceType;
  source: string;
  authority: EvidenceAuthority;
  toolName?: string;
  resultStatus?: 'SUCCESS_WITH_DATA' | 'SUCCESS_NO_DATA' | 'ERROR';
  recordCount?: number;
  facts?: EvidenceFact[];
  rag?: Pick<RagEvidence, 'chunkId' | 'documentId' | 'sourceId' | 'citationLabel' | 'jurisdiction' | 'content'>;
}

export const VerificationStatus = {
  VERIFIED: 'VERIFIED',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  CONTRADICTED: 'CONTRADICTED',
  SAFETY_BLOCKED: 'SAFETY_BLOCKED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export interface VerificationResult {
  status: VerificationStatus;
  claimsConsidered: number;
  verifiedClaims: number;
  unsupportedClaims: number;
  evidenceItemsConsidered: number;
  evidenceSourceTypes: EvidenceSourceType[];
  sources: string[];
  reasons: string[];
}

const SENSITIVE_FACT_KEY = /(?:responsible|person|name|email|phone|medical|witness|injured|description|content|password|secret|token)/i;
const MAX_FACTS = 80;

function collectFacts(value: unknown, path = 'data', output: EvidenceFact[] = []): EvidenceFact[] {
  if (output.length >= MAX_FACTS) return output;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    if (!SENSITIVE_FACT_KEY.test(path)) output.push({ path, value: value as EvidenceFact['value'] });
    return output;
  }
  if (Array.isArray(value)) {
    value.slice(0, 50).forEach((item, index) => collectFacts(item, `${path}[${index}]`, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (!SENSITIVE_FACT_KEY.test(key)) collectFacts(item, `${path}.${key}`, output);
    });
  }
  return output;
}

export function toolResultEvidence(toolName: string, output: unknown, sequence: number): AgentEvidence {
  const value = output && typeof output === 'object' ? output as Record<string, unknown> : {};
  const failed = value.error === true;
  const resultStatus = failed
    ? 'ERROR'
    : value.status === 'SUCCESS_WITH_DATA' || value.status === 'SUCCESS_NO_DATA'
      ? value.status
      : undefined;
  const recordCount = typeof value.recordCount === 'number' && Number.isFinite(value.recordCount)
    ? value.recordCount
    : undefined;
  return {
    id: `tool:${sequence}:${toolName}`,
    sourceType: EvidenceSourceType.TOOL,
    source: toolName,
    authority: EvidenceAuthority.OPERATIONAL,
    toolName,
    ...(resultStatus ? { resultStatus } : {}),
    ...(recordCount !== undefined ? { recordCount } : {}),
    facts: failed ? [] : collectFacts(value.data),
  };
}

export function ragResultEvidence(item: RagEvidence): AgentEvidence {
  return {
    id: `rag:${item.chunkId}`,
    sourceType: EvidenceSourceType.RAG,
    source: item.sourceId,
    authority: EvidenceAuthority.APPROVED_KNOWLEDGE,
    rag: {
      chunkId: item.chunkId,
      documentId: item.documentId,
      sourceId: item.sourceId,
      citationLabel: item.citationLabel,
      jurisdiction: item.jurisdiction,
      content: item.content,
    },
  };
}
