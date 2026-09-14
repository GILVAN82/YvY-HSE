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
  attention?: import('../shared/attention/attention.presenter').AttentionFacts;
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
    observability?: { prompt?: {version:string;fingerprint:string}; provider?:string; model?:string; stages:Array<{stage:string;durationMs:number}>; usage:{status:'AVAILABLE'|'NOT_AVAILABLE';inputTokens?:number;outputTokens?:number;totalTokens?:number}; cost:'NOT_AVAILABLE'; error?:{category:string;code:string;recoverable:boolean} };
    timestamp: string;
    responseLanguage?: string;
    authenticatedUser?: string;
    route: string[];
    tools: AgentToolTrace[];
    rag: { used: boolean; status: string; chunksRetrieved: number; diagnostics?: { retrievalMode:string;relevanceState:string;reformulationStatus:string;configFingerprint:string } };
    conversation: { stateActive: boolean; messageCount: number };
    memory: { used: boolean; operation: string; categories: string[]; status: string };
    guardrail: { status: string; reason?: string };
    intent?: { input: string; normalizedQuery: string; scope: string; confidence: string; intent: string; candidateTools: string[]; selectedTool?: string; selectedTools?: string[]; clarificationRequired: boolean };
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
export interface DemoHumanApprovalContext {
  demoSessionId:string; requestInstanceId:string; approvalId:string; resourceId:string; projectId:string;
  status:ApprovalSnapshot['status']; decisionMadeDuringCurrentDemo:boolean;
}
const ALERT_STORAGE_KEY = 'yvy-hse-agent-inspector-alert-events';

@Injectable({ providedIn: 'root' })
export class AgentInspectorService {
  readonly demoPreset=signal(false);
  readonly demoApproval=signal<ApprovalSnapshot|null>(null);
  readonly demoHumanContext=signal<DemoHumanApprovalContext|null>(null);
  readonly demoApprovalRun=signal<AgentInspectorSnapshot|null>(null);
  readonly voiceEngine=signal<{requestedEngine:string;effectiveEngine:string;fallbackReason:string|null;voiceName:string|null}|null>(null);
  readonly voiceSession=signal<{authenticatedUser:string|null;voiceResponseMode:string;inputMode:'TEXT'|'VOICE';autoVoice:boolean;spokenPolicy:'FACTUAL'|'EVIDENCE_LIMITED'|'TECHNICAL_ERROR'|'NONE';verificationStatus:string|null}|null>(null);
  readonly latest = signal<AgentInspectorSnapshot | null>(this.read());
  readonly alertEvents = signal<YvyAlertEvent[]>(this.readAlertEvents());
  readonly attentionScheduler=signal<AttentionSchedulerHealth|null>(null);

  record(payload: unknown) {
    if (!payload || typeof payload !== 'object') return;
    const value = sanitizeSnapshot(payload as AgentInspectorSnapshot);
    if (!value.runId || !value.threadId || value.status === undefined) return;
    this.latest.set(value);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Demo trace remains in memory. */ }
  }

  /** Presentation isolation changes only the run snapshot, not normal attention/voice diagnostics. */
  clearRun(){this.latest.set(null);try{sessionStorage.removeItem(STORAGE_KEY);}catch{}}

  /** Clears only the browser-side Inspector snapshot. It never calls the API. */
  clear() {
    this.latest.set(null);
    this.alertEvents.set([]);
    this.attentionScheduler.set(null);
    this.voiceSession.set(null);
    try { sessionStorage.removeItem(STORAGE_KEY);sessionStorage.removeItem(ALERT_STORAGE_KEY); } catch { /* In-memory trace is already cleared. */ }
  }

  /** Synchronizes only from the persisted approval returned by the backend. */
  recordApproval(approval: ApprovalSnapshot) {
    const current = this.latest();
    if (!current || (current.threadId !== approval.threadId && !(current.approvalRequest?.approvalId===approval.approvalId && current.approvalRequest.threadId===approval.threadId))) return;
    this.record({ ...current, status: approval.status, responseStatus: approval.status === 'APPROVED' ? 'APPROVED' : approval.status === 'REJECTED' ? 'REJECTED' : 'PENDING', approvalRequest: approval });
  }
  recordAlertEvents(events:YvyAlertEvent[]){const safe=events.slice(0,50).map(({id,alertId,eventType,severity,category,sourceType,ruleId,evidenceCount,createdAt,metadata})=>({id,alertId,eventType,severity,category,sourceType,ruleId,evidenceCount,createdAt,metadata}));this.alertEvents.set(safe);try{sessionStorage.setItem(ALERT_STORAGE_KEY,JSON.stringify(safe));}catch{}}
  recordAttentionScheduler(health:AttentionSchedulerHealth){this.attentionScheduler.set(health);}

  private read(): AgentInspectorSnapshot | null {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      return value && typeof value.runId === 'string' ? sanitizeSnapshot(value) : null;
    } catch { return null; }
  }
  private readAlertEvents():YvyAlertEvent[]{try{const value=JSON.parse(sessionStorage.getItem(ALERT_STORAGE_KEY)||'[]');return Array.isArray(value)?value:[];}catch{return[];}}
}

/** Store only Inspector fields; never carry draft payloads, prompts or request bodies. */
export function sanitizeSnapshot(value: AgentInspectorSnapshot): AgentInspectorSnapshot {
  const trace=value.executionTrace;
  return { runId:value.runId,threadId:value.threadId,status:value.status,responseStatus:value.responseStatus,stepCount:value.stepCount,toolsUsed:value.toolsUsed,ragUsed:value.ragUsed,citations:value.citations,errorCode:value.errorCode,orchestrator:value.orchestrator,
    approvalRequest:value.approvalRequest ? {...value.approvalRequest,resolutionNote:undefined} : undefined,
    executionTrace:trace ? {timestamp:trace.timestamp,responseLanguage:trace.responseLanguage,route:trace.route,rag:trace.rag,conversation:trace.conversation,memory:trace.memory,guardrail:trace.guardrail,verification:trace.verification,error:trace.error,observability:trace.observability,intent:trace.intent ? {...trace.intent,input:'',normalizedQuery:''}:undefined,
      tools:(trace.tools ?? []).map(tool=>({name:tool.name,status:tool.status,resultStatus:tool.resultStatus,resultSummary:tool.resultSummary,arguments:tool.name==='get_attention_alert'&&typeof tool.arguments?.['alertId']==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(tool.arguments['alertId'])?{alertId:tool.arguments['alertId']}:undefined})),
    } : undefined };
}
