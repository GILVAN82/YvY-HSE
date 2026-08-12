import { Injectable, signal } from '@angular/core';

export interface AgentToolTrace {
  name: string;
  status: 'COMPLETED' | 'ERROR' | 'NOT_OBSERVABLE';
  arguments?: Record<string, string | number | boolean | null>;
  resultSummary?: string;
}

export interface AgentInspectorSnapshot {
  runId: string;
  threadId: string;
  status: string;
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

@Injectable({ providedIn: 'root' })
export class AgentInspectorService {
  readonly latest = signal<AgentInspectorSnapshot | null>(this.read());

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
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* In-memory trace is already cleared. */ }
  }

  /** Synchronizes only from the persisted approval returned by the backend. */
  recordApproval(approval: ApprovalSnapshot) {
    const current = this.latest();
    if (!current || current.threadId !== approval.threadId) return;
    this.record({ ...current, status: approval.status, approvalRequest: approval });
  }

  private read(): AgentInspectorSnapshot | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      return value && typeof value.runId === 'string' ? value : null;
    } catch { return null; }
  }
}
