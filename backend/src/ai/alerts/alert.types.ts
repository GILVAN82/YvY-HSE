export type YvyAlertSeverity='INFO'|'ATTENTION'|'HIGH'|'CRITICAL';
export type YvyAlertStatus='NEW'|'ALERTED'|'ACKNOWLEDGED'|'RESOLVED';
export interface AlertEvidence{field:string;value:string|number;}
export interface YvyProactiveAlert{ id:string;fingerprint:string;severity:YvyAlertSeverity;category:'OVERDUE_ACTION'|'PENDING_APPROVAL';title:string;summary:string;sourceType:'OPERATIONAL_DATA'|'HITL';sourceId:string;evidence:AlertEvidence[];ruleId:string;status:YvyAlertStatus;createdAt:string;updatedAt:string;alertedAt?:string;acknowledgedAt?:string;resolvedAt?:string;snoozedUntil?:string; }
export interface AlertCandidate extends Omit<YvyProactiveAlert,'id'|'status'|'createdAt'|'updatedAt'|'alertedAt'|'acknowledgedAt'|'resolvedAt'|'snoozedUntil'>{}
