import type { AgentErrorCode, AgentStatus, RefusalCode } from '../graph/hseAgent.types';

export const EVALUATION_CATEGORIES = [
  'RAG_GROUNDING', 'OPERATIONAL_ROUTING', 'DATA_MINIMIZATION', 'CITATION', 'SAFETY',
  'JURISDICTION', 'THREAD_STATE', 'THREAD_ISOLATION', 'MEMORY_POLICY', 'HITL',
  'REFUSAL', 'SECRET_PROTECTION', 'FAILURE_RECOVERY', 'DOMAIN_SCOPE',
  'EVIDENCE_GROUNDING', 'ZERO_RESULT', 'AUTHORIZATION',
] as const;
export type EvaluationCategory = typeof EVALUATION_CATEGORIES[number];

export interface EvaluationExpectation {
  allowedStatuses?: AgentStatus[];
  requiredTools?: string[];
  forbiddenTools?: string[];
  ragUsed?: boolean;
  citationRequired?: boolean;
  sourceIdIncludes?: string;
  requiredSources?: string[];
  relevantSources?: string[];
  refusalReason?: RefusalCode;
  errorCode?: AgentErrorCode;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  threadLeakage?: boolean;
  memoryWriteCount?: number;
  secretExposed?: boolean;
  jurisdictionQualified?: boolean;
  noRelevantEvidence?: boolean;
  citationSourceValid?: boolean;
  vectorExposed?: boolean;
  operationalFieldsExactly?: string[];
  portfolioWildcardNormalized?: boolean;
  blankStatusIgnored?: boolean;
  overdueFilterApplied?: boolean;
  threadContinuity?: boolean;
  memoryRetrieved?: boolean;
  memoryForgotten?: boolean;
  hitlBypassed?: boolean;
  databaseReadOnly?: boolean;
  domainScopeEnforced?: boolean;
  responseStatus?: 'SUCCESS' | 'NO_DATA' | 'ERROR' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUSED';
  expectedOperationalFact?: number;
  fabricatedOperationalRecords?: number;
  verificationStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTED' | 'SAFETY_BLOCKED';
  unsupportedClaims?: number;
}

export interface EvaluationCase {
  id: string;
  version: number;
  category: EvaluationCategory;
  title: string;
  input: string;
  expectation: EvaluationExpectation;
  evidenceNote: string;
  language?: string;
  setup?: { sameThread?: boolean; separateThreads?: boolean; explicitMemory?: boolean; failureMode?: string };
}

export interface AgentObservation {
  status: AgentStatus;
  toolsUsed: string[];
  ragUsed: boolean;
  citationLabels: string[];
  sourceIds: string[];
  refusalReason?: RefusalCode;
  errorCode?: AgentErrorCode;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  threadLeakage?: boolean;
  memoryWriteCount?: number;
  secretExposed?: boolean;
  jurisdictionQualified?: boolean;
  noRelevantEvidence?: boolean;
  citationSourceValid?: boolean;
  vectorExposed?: boolean;
  operationalFields?: string[];
  portfolioWildcardNormalized?: boolean;
  blankStatusIgnored?: boolean;
  overdueFilterApplied?: boolean;
  threadContinuity?: boolean;
  memoryRetrieved?: boolean;
  memoryForgotten?: boolean;
  hitlBypassed?: boolean;
  databaseReadOnly?: boolean;
  domainScopeEnforced?: boolean;
  responseStatus?: 'SUCCESS' | 'NO_DATA' | 'ERROR' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUSED';
  operationalFact?: number;
  fabricatedOperationalRecords?: number;
  verificationStatus?: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTED' | 'SAFETY_BLOCKED';
  unsupportedClaims?: number;
}

export interface EvaluationCheck { name: string; passed: boolean; evidence: string; }
export interface EvaluationCaseResult { caseId: string; category: EvaluationCategory; passed: boolean; checks: EvaluationCheck[]; durationMs: number; observation?: AgentObservation; }
export interface EvaluationReport {
  schemaVersion: 2;
  provenance?: import('./evaluation.provenance').EvaluationProvenance;
  datasetVersion: number;
  startedAt: string;
  completedAt: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  metricName: 'scenario pass rate';
  executionMode: 'CONTROLLED_OFFLINE' | 'LIVE_SAFE_SUBSET';
  categoryResults: Record<string, { passed: number; total: number }>;
  metrics: Record<string, { passed: number; total: number; percentage: number | null }>;
  results: EvaluationCaseResult[];
}

export type EvaluationExecutor = (evaluationCase: EvaluationCase) => Promise<AgentObservation>;
