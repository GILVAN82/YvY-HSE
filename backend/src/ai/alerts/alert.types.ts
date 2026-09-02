export type YvyAlertSeverity='INFO'|'ATTENTION'|'HIGH'|'CRITICAL';
export type YvyAlertStatus='NEW'|'ALERTED'|'ACKNOWLEDGED'|'RESOLVED';
export interface AlertEvidence{field:string;value:string|number;}
export interface YvyProactiveAlert{ id:string;fingerprint:string;severity:YvyAlertSeverity;category:'OVERDUE_ACTION'|'PENDING_APPROVAL';title:string;summary:string;sourceType:'OPERATIONAL_DATA'|'HITL';sourceId:string;evidence:AlertEvidence[];ruleId:string;status:YvyAlertStatus;createdAt:string;updatedAt:string;alertedAt?:string;acknowledgedAt?:string;resolvedAt?:string;snoozedUntil?:string;lastVisualNotificationAt?:string;lastVoiceNotificationAt?:string;notificationCount:number;nextEligibleNotificationAt?:string; }
export interface AlertCandidate extends Omit<YvyProactiveAlert,'id'|'status'|'createdAt'|'updatedAt'|'alertedAt'|'acknowledgedAt'|'resolvedAt'|'snoozedUntil'|'lastVisualNotificationAt'|'lastVoiceNotificationAt'|'notificationCount'|'nextEligibleNotificationAt'>{}
export type AlertEventType='EVALUATED'|'CREATED'|'UPDATED'|'SEVERITY_CHANGED'|'SURFACED'|'VOICE_QUEUED'|'VOICE_SPOKEN'|'ACKNOWLEDGED'|'SNOOZED'|'RESOLVED';
export interface AlertLifecycleEvent{id:string;alertId:string;eventType:AlertEventType;severity:YvyAlertSeverity;category:string;sourceType:string;ruleId:string;evidenceCount:number;createdAt:string;metadata:Record<string,unknown>}
