import { Injectable, signal } from '@angular/core';
import type { AttentionSchedulerHealth, YvyAlertEvent } from '../pages/ai-command-center/yvy-alert.service';

export interface AgentToolTrace {
  name: string;
  status: 'COMPLETED' | 'ERROR' | 'NOT_OBSERVABLE';
  arguments?: Record<string, string | number | boolean | null>;
  resultSummary?: string;
  resultStatus?: 'SUCCESS_WITH_DATA' | 'SUCCESS_NO_DATA';
}

export type AgentResponseStatus = 'SUCCESS' | 'NO_DATA' | 'ERROR' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUSED';

export interface AgentInspectorSnapshot {
  runId: string;
  threadId: string;
  status: string;
  responseStatus?: AgentResponseStatus;
  stepCount: number;
  toolsUsed: string[];
  ragUsed: boolean;
  citations: Array<{ sourceId: string; citationLabel: string; sourceUrl: string; jurisdiction: string }>;
  approvalRequest?: ApprovalSnapshot;
  errorCode?: string;
  orchestrator: string;
  executionTrace?: {
    timestamp: string;
    route: string[];
    tools: AgentToolTrace[];
    rag: { used: boolean; status: string; chunksRetrieved: number };
    conversation: { stateActive: boolean; messageCount: number };
    memory: { used: boolean; operation: string; categories: string[]; status: string };
    guardrail: { status: string; reason?: string };
    verification: {
      status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTED' | 'SAFETY_BLOCKED';
      claimsConsidered: number; verifiedClaims: number; unsupportedClaims: number;
      evidenceItemsConsidered: number; evidenceSourceTypes: string[]; sources: string[]; reasons: string[];
    };
    error?: { category: string; node: string; recoverable: boolean };
  };
}

export interface ApprovalSnapshot {
  approvalId: string;
  threadId: string;
  actionType: string;
  riskLevel: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

const STORAGE_KEY = 'yvy-hse-agent-inspector-latest';
const ALERT_STORAGE_KEY = 'yvy-hse-agent-inspector-alert-events';

@Injectable({ providedIn: 'root' })
export class AgentInspectorService {
  readonly voiceEngine=signal<{requestedEngine:string;effectiveEngine:string;fallbackReason:string|null;voiceName:string|null}|null>(null);
  readonly latest = signal<AgentInspectorSnapshot | null>(this.read());
  readonly alertEvents = signal<YvyAlertEvent[]>(this.readAlertEvents());
  readonly attentionScheduler=signal<AttentionSchedulerHealth|null>(null);

  record(payload: unknown) {
    if (!payload || typeof payload !== 'object') return;
    const value = payload as AgentInspectorSnapshot;
    if (!value.runId || !value.threadId || value.status === undefined) return;
    this.latest.set(value);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Demo trace remains in memory. */ }
  }

  /** Clears only the browser-side Inspector snapshot. It never calls the API. */
  clear() {
    this.latest.set(null);
    this.alertEvents.set([]);
    this.attentionScheduler.set(null);
    try { sessionStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem(ALERT_STORAGE_KEY); } catch { /* In-memory trace is already cleared. */ }
  }

  /** Synchronizes only from the persisted approval returned by the backend. */
  recordApproval(approval: ApprovalSnapshot) {
    const current = this.latest();
    if (!current || current.threadId !== approval.threadId) return;
    this.record({ ...current, status: approval.status, responseStatus: approval.status === 'APPROVED' ? 'APPROVED' : approval.status === 'REJECTED' ? 'REJECTED' : 'PENDING', approvalRequest: approval });
  }
  recordAlertEvents(events:YvyAlertEvent[]){const safe=events.slice(0,50).map(({id,alertId,eventType,severity,category,sourceType,ruleId,evidenceCount,createdAt,metadata})=>({id,alertId,eventType,severity,category,sourceType,ruleId,evidenceCount,createdAt,metadata}));this.alertEvents.set(safe);try{sessionStorage.setItem(ALERT_STORAGE_KEY,JSON.stringify(safe));}catch{}}
  recordAttentionScheduler(health:AttentionSchedulerHealth){this.attentionScheduler.set(health);}

  private read(): AgentInspectorSnapshot | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      return value && typeof value.runId === 'string' ? value : null;
    } catch { return null; }
  }
  private readAlertEvents():YvyAlertEvent[]{try{const value=JSON.parse(sessionStorage.getItem(ALERT_STORAGE_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
}
