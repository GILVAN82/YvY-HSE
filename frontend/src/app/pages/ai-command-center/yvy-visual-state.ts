export type YvyAgentVisualState =
  | 'ready'
  | 'analysing'
  | 'retrieving'
  | 'using-tool'
  | 'verifying'
  | 'waiting-approval'
  | 'verified'
  | 'error';

export type YvyWorkflowStage = 'guard' | 'tools' | 'rag' | 'verify' | 'approval' | null;
export type YvyVerificationStatus = 'IDLE' | 'VERIFYING' | 'VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTED' | 'SAFETY_BLOCKED';
export type YvyApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface YvyVisualState {
  agentState: YvyAgentVisualState;
  activeCapability?: string;
  activeWorkflowStage: YvyWorkflowStage;
  verificationStatus: YvyVerificationStatus;
  approvalStatus: YvyApprovalStatus;
}
