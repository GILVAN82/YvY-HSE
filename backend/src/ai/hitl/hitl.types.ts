import type { RequestPrincipal } from '../../auth/auth.types';
export const APPROVAL_ACTION_TYPES = ['LOTO_SAFETY_EXECUTION'] as const;
export type ApprovalActionType = typeof APPROVAL_ACTION_TYPES[number];
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type HumanDecision = 'APPROVE' | 'REJECT';

export interface ApprovalRequest {
  approvalId: string;
  threadId: string;
  actionType: ApprovalActionType;
  summary: string;
  reason: string;
  riskLevel: 'CRITICAL';
  status: ApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ApprovalService {
  forPrincipal?(principal:RequestPrincipal,message?:string):ApprovalService;
  create(threadId: string, actionType: ApprovalActionType): Promise<ApprovalRequest>;
  resolve(approvalId: string, threadId: string, decision: HumanDecision, note?: string, resolvedByUserId?: string): Promise<ApprovalRequest>;
  get(approvalId: string): Promise<ApprovalRequest | null>;
  deleteForTest(approvalId: string): Promise<void>;
}
