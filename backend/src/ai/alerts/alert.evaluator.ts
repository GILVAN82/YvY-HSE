import type{AlertCandidate}from'./alert.types';
export interface AlertAction{actionId:string;description:string;priority?:string;daysOverdue:number;status:string;}
export interface AlertApproval{approvalId:string;summary:string;riskLevel:'CRITICAL';status:string;}
const priority=(value='')=>value.trim().toUpperCase();
export function evaluateAlerts(input:{actions:AlertAction[];approvals:AlertApproval[]}):AlertCandidate[]{
 const actions=input.actions.filter(a=>a.daysOverdue>0&&a.status.toUpperCase()!=='CLOSED').map(a=>{const severe=['HIGH','CRITICAL'].includes(priority(a.priority));return{fingerprint:`overdue-action:${a.actionId}`,severity:severe?'HIGH' as const:'ATTENTION' as const,category:'OVERDUE_ACTION' as const,title:severe?'High-priority action overdue':'Action overdue',summary:`${a.description} — ${a.daysOverdue} day${a.daysOverdue===1?'':'s'} overdue`,sourceType:'OPERATIONAL_DATA' as const,sourceId:a.actionId,evidence:[{field:'status',value:a.status},{field:'daysOverdue',value:a.daysOverdue},{field:'priority',value:a.priority||'UNSPECIFIED'}],ruleId:severe?'HIGH_PRIORITY_OVERDUE_ACTION':'OVERDUE_ACTION'};});
 const approvals=input.approvals.filter(a=>a.status==='PENDING').map(a=>({fingerprint:`pending-approval:${a.approvalId}`,severity:'CRITICAL' as const,category:'PENDING_APPROVAL' as const,title:'Critical approval waiting',summary:a.summary,sourceType:'HITL' as const,sourceId:a.approvalId,evidence:[{field:'status',value:a.status},{field:'riskLevel',value:a.riskLevel}],ruleId:'CRITICAL_PENDING_HITL'}));
 return [...actions,...approvals];
}
