import { AuthService } from '../../core/auth.service';
import { Injectable, NgZone, Optional, computed, effect, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
export type YvyAlertSeverity='INFO'|'ATTENTION'|'HIGH'|'CRITICAL';export type YvyAlertStatus='NEW'|'ALERTED'|'ACKNOWLEDGED'|'RESOLVED';
export interface YvyAlert{businessStatus?:string;projectLabel?:string;approvalActionType?:string;voiceClaimToken?:string;id:string;severity:YvyAlertSeverity;category:'OVERDUE_ACTION'|'PENDING_APPROVAL';title:string;summary:string;sourceType:'OPERATIONAL_DATA'|'HITL';sourceId:string;evidence:Array<{field:string;value:string|number}>;ruleId:string;status:YvyAlertStatus;createdAt:string;acknowledgedAt?:string;resolvedAt?:string;snoozedUntil?:string;lastVisualNotificationAt?:string;lastVoiceNotificationAt?:string;notificationCount:number;nextEligibleNotificationAt?:string;}
export interface YvyAlertEvent{id:string;alertId:string;eventType:string;severity:YvyAlertSeverity;category:string;sourceType:string;ruleId:string;evidenceCount:number;createdAt:string;metadata:Record<string,unknown>}
export interface AttentionSchedulerHealth{enabled:boolean;status:'HEALTHY'|'DEGRADED'|'DISABLED'|'UNAVAILABLE';leader:boolean;running:boolean;lastRunAt?:string;lastSuccessfulRunAt?:string;lastRun?:{status:string;scopesEvaluated:number;alertsCreated:number;alertsUpdated:number;alertsResolved:number}}
export interface ReturnAttentionSummary{INFO:number;ATTENTION:number;HIGH:number;CRITICAL:number;total:number}
export interface AlertPreferences{criticalVoice:boolean;highVoice:boolean;routineReminders:boolean;desktopNotifications:boolean;}
export type AlertStatusFilter='ACTIVE'|'ACKNOWLEDGED'|'RESOLVED'|'ALL';export type AlertSeverityFilter=YvyAlertSeverity|'ALL';
@Injectable({providedIn:'root'})
export class YvyAlertService{
 constructor(private readonly zone:NgZone=new NgZone({enableLongStackTrace:false}), @Optional() private readonly auth:AuthService|null=null){
   this.owner=this.auth?.user()?.userId??null;this.preferences.set(this.readPreferences());
   if(this.auth)effect(()=>{this.auth!.user();this.syncIdentity();},{allowSignalWrites:true});
 }
 readonly alerts=signal<YvyAlert[]>([]);readonly events=signal<YvyAlertEvent[]>([]);readonly voiceCandidates=signal<YvyAlert[]>([]);readonly loading=signal(false);readonly error=signal('');readonly evaluatedAt=signal('');readonly scheduler=signal<AttentionSchedulerHealth>({enabled:false,status:'UNAVAILABLE',leader:false,running:false});readonly returnSummary=signal<ReturnAttentionSummary>({INFO:0,ATTENTION:0,HIGH:0,CRITICAL:0,total:0});readonly preferences=signal<AlertPreferences>(this.readPreferences());readonly statusFilter=signal<AlertStatusFilter>('ACTIVE');readonly severityFilter=signal<AlertSeverityFilter>('ALL');
 readonly active=computed(()=>this.alerts().filter(a=>!['RESOLVED','ACKNOWLEDGED'].includes(a.status)&&!['RESOLVED','ACKNOWLEDGED','APPROVED','REJECTED','CANCELLED'].includes(a.businessStatus??a.status)&&(!a.snoozedUntil||new Date(a.snoozedUntil)<=new Date())));readonly critical=computed(()=>this.active().filter(a=>a.severity==='CRITICAL').length);readonly high=computed(()=>this.active().filter(a=>a.severity==='HIGH').length);readonly filtered=computed(()=>this.alerts().filter(a=>(this.statusFilter()==='ALL'||(this.statusFilter()==='ACTIVE'&&!['RESOLVED','ACKNOWLEDGED'].includes(a.status)&&!['ACKNOWLEDGED','RESOLVED','APPROVED','REJECTED','CANCELLED'].includes(a.businessStatus??a.status))||a.status===this.statusFilter())&&(this.severityFilter()==='ALL'||a.severity===this.severityFilter())));
 private sessionGeneration=0;
 private owner:string|null=null;
 private controller=new AbortController();
 private syncIdentity(){const next=this.auth?.user()?.userId??null;if(next!==this.owner){this.owner=next;this.resetVoiceSession();}}
 private current(generation:number){this.syncIdentity();return generation===this.sessionGeneration;}
 private async request(path:string,init:RequestInit={}) {
   this.syncIdentity();if(this.auth&&!this.owner)throw new Error('AUTHENTICATION_REQUIRED');
   const generation=this.sessionGeneration;
   const response=await fetch(`${environment.apiUrl}/ai/alerts${path}`,{...init,credentials:'include',signal:this.controller.signal});
   if(!this.current(generation))throw new Error('STALE_SESSION');
   if(!response.ok)throw new Error('ALERT_UNAVAILABLE');
   const body=response.status===204?{}:await response.json();
   if(!this.current(generation))throw new Error('STALE_SESSION');return body;
 }
 private preferencesKey(){return this.owner?`yvy-alert-preferences:${this.owner}`:'yvy-alert-preferences';}
 resetVoiceSession(){this.sessionGeneration++;this.controller.abort();this.controller=new AbortController();this.voiceCandidates.set([]);this.alerts.set([]);this.events.set([]);this.loading.set(false);this.error.set('');this.evaluatedAt.set('');this.scheduler.set({enabled:false,status:'UNAVAILABLE',leader:false,running:false});this.returnSummary.set({INFO:0,ATTENTION:0,HIGH:0,CRITICAL:0,total:0});this.statusFilter.set('ACTIVE');this.severityFilter.set('ALL');this.preferences.set(this.readPreferences());}
 async refresh(){this.syncIdentity();const generation=this.sessionGeneration;this.loading.set(true);this.error.set('');try{const body=await this.request('');if(!this.current(generation))return false;this.alerts.set(body.alerts??[]);this.events.set(body.events??[]);this.scheduler.set(body.scheduler??{enabled:false,status:'UNAVAILABLE',leader:false,running:false});this.returnSummary.set(body.returnSummary??{INFO:0,ATTENTION:0,HIGH:0,CRITICAL:0,total:0});this.evaluatedAt.set(body.scheduler?.lastRunAt??body.readAt??'');await this.claimVoice();if(!this.current(generation))return false;this.notifyDesktop();return true;}catch{if(this.current(generation)){this.alerts.set([]);this.events.set([]);this.voiceCandidates.set([]);this.error.set('Attention data is temporarily unavailable.');this.scheduler.update(value=>({...value,status:'UNAVAILABLE'}));}return false;}finally{if(this.current(generation))this.loading.set(false);}}
 startContinuousAttention(onRefresh:()=>void,intervalMs=90_000){let timer:ReturnType<typeof setInterval>;this.zone.runOutsideAngular(()=>{timer=setInterval(()=>{void this.refresh().then(ok=>{if(ok)this.zone.run(onRefresh);});},intervalMs);});return()=>clearInterval(timer);}
 async acknowledge(id:string){return this.update(id,'acknowledge');}
 /** Apply only a successfully resolved server response; never resolve an alert here. */
 applyApprovalStatus(approvalId:string,status:string){
   if(!['APPROVED','REJECTED','CANCELLED'].includes(status))return;
   this.alerts.update(items=>items.map(item=>item.sourceType==='HITL'&&item.sourceId===approvalId?{...item,businessStatus:status}:item));
   this.voiceCandidates.update(items=>items.filter(item=>item.sourceType!=='HITL'||item.sourceId!==approvalId));
 }
 async snooze(id:string,minutes:30|60|720){return this.update(id,'snooze',{minutes});}
 async markVoiceSpoken(id:string,claimToken?:string){this.syncIdentity();if(!claimToken||!this.voiceCandidates().some(a=>a.id===id&&a.voiceClaimToken===claimToken))return;try{await this.request(`/${encodeURIComponent(id)}/notifications/voice/spoken`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({claimToken})});}catch{}}
 setPreferences(value:AlertPreferences){this.preferences.set(value);try{localStorage.setItem(this.preferencesKey(),JSON.stringify(value));}catch{}if(value.desktopNotifications&&typeof Notification!=='undefined'&&Notification.permission==='default')void Notification.requestPermission();}
 private async update(id:string,action:string,body?:unknown){this.syncIdentity();const generation=this.sessionGeneration;try{const result=await this.request(`/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!this.current(generation))return false;this.replace(result.alert);return true;}catch{return false;}}
 private replace(alert:YvyAlert){this.alerts.update(items=>items.map(a=>a.id===alert.id?alert:a));}
 private async claimVoice(){const generation=this.sessionGeneration;const prefs=this.preferences(),ids=this.active().filter(a=>(a.severity==='CRITICAL'&&prefs.criticalVoice)||(a.severity==='HIGH'&&prefs.highVoice)).map(a=>a.id);if(!ids.length){this.voiceCandidates.set([]);return;}const body=await this.request('/notifications/voice/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(this.current(generation))this.voiceCandidates.set(body.alerts??[]);}
 private notifyDesktop(){if(!this.preferences().desktopNotifications||typeof Notification==='undefined'||Notification.permission!=='granted'||!this.voiceCandidates().length)return;const count=this.voiceCandidates().length;const note=new Notification('YvY HSE attention',{body:`${count} safety item${count===1?'':'s'} require review. Open YvY for details.`,tag:'yvy-hse-attention'});note.onclick=()=>{window.focus();window.location.hash='';note.close();};}
 private readPreferences():AlertPreferences{try{return{criticalVoice:true,highVoice:false,routineReminders:false,desktopNotifications:false,...JSON.parse(localStorage.getItem(this.preferencesKey())||'{}')}}catch{return{criticalVoice:true,highVoice:false,routineReminders:false,desktopNotifications:false}}}
}
