export type AttentionRunStatus='RUNNING'|'COMPLETED'|'PARTIAL'|'FAILED'|'SKIPPED';
export interface AttentionSchedulerRun{id:string;startedAt:string;completedAt?:string;status:AttentionRunStatus;durationMs?:number;scopesEvaluated:number;sourcesEvaluated:number;alertsCreated:number;alertsUpdated:number;alertsResolved:number;errorCount:number;}
export interface AttentionSchedulerHealth{enabled:boolean;status:'HEALTHY'|'DEGRADED'|'DISABLED'|'UNAVAILABLE';leader:boolean;running:boolean;lastRunAt?:string;lastSuccessfulRunAt?:string;lastRun?:AttentionSchedulerRun;}
export interface DeliverableAlert{id:string;severity:'INFO'|'ATTENTION'|'HIGH'|'CRITICAL';title:string;summary:string;}
export interface DeliveryResult{status:'DELIVERED'|'SKIPPED'|'FAILED';channel:string;deliveredAt?:string;}
export interface AlertDeliveryChannel{readonly channel:string;deliver(alert:DeliverableAlert):Promise<DeliveryResult>;}
