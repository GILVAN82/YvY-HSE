import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Send, ShieldCheck, Scale, TriangleAlert, Factory, Users, FileCheck2, BookOpen, BadgeCheck, Wrench, Database, UserCheck, Mic, Square, X, Volume2, VolumeX, RotateCcw } from 'lucide-angular';
import { YvyAiCoreComponent } from './components/yvy-ai-core.component';
import { YvyCapabilityNodeComponent } from './components/yvy-capability-node.component';
import { YvyHudPanelComponent } from './components/yvy-hud-panel.component';
import { YvyWorkflowComponent } from './components/yvy-workflow.component';
import { YvyResponsePanelComponent } from './components/yvy-response-panel.component';
import { YvyDetailsDrawerComponent } from './components/yvy-details-drawer.component';
import { YvyCommandCenterAgentService } from './yvy-command-center-agent.service';
import { AuthService } from '../../core/auth.service';
import type { YvyAgentVisualState, YvyVisualState, YvyWorkflowStage } from './yvy-visual-state';
import { SpeechRecognitionService } from './voice/speech-recognition.service';
import { VoiceEngineService } from './voice/voice-engine.service';
import { VoiceSettingsComponent } from './voice/voice-settings.component';
import { languageName } from './voice/language-resolution';
import type { VoiceStatus } from './voice/voice.types';
import type { VoiceConversationTurn } from './voice/voice.types';
import { SpokenResponseFormatterService } from './voice/spoken-response-formatter.service';
import { YvyAlertService, type YvyAlert } from './yvy-alert.service';
import { ProactiveVoiceQueue } from './voice/proactive-voice-queue';
import { AgentInspectorService } from '../../core/agent-inspector.service';

@Component({
  selector: 'app-yvy-ai-command-center', standalone: true,
  imports: [VoiceSettingsComponent, CommonModule, FormsModule, RouterLink, LucideAngularModule, YvyAiCoreComponent, YvyCapabilityNodeComponent, YvyHudPanelComponent, YvyWorkflowComponent, YvyResponsePanelComponent, YvyDetailsDrawerComponent],
  templateUrl: './yvy-ai-command-center.component.html', styleUrl: './yvy-ai-command-center.component.scss',
})
export class YvyAiCommandCenterComponent implements OnInit,OnDestroy {
  readonly agent=inject(YvyCommandCenterAgentService);readonly auth=inject(AuthService);readonly speechRecognition=inject(SpeechRecognitionService);readonly speechSynthesis=inject(VoiceEngineService);readonly spokenFormatter=inject(SpokenResponseFormatterService);readonly alerts=inject(YvyAlertService);private readonly inspector=inject(AgentInspectorService);private readonly proactiveVoiceQueue=new ProactiveVoiceQueue();private stopContinuousAttention:()=>void=()=>{};
  readonly sendIcon = Send;
  readonly micIcon=Mic;readonly stopIcon=Square;readonly cancelIcon=X;readonly volumeIcon=Volume2;readonly mutedIcon=VolumeX;readonly replayIcon=RotateCcw;
  readonly voiceStatus=signal<VoiceStatus>('idle');readonly voiceError=signal('');readonly muted=signal(false);readonly languageName=languageName;
  readonly voiceConversation=signal<VoiceConversationTurn[]>([]);readonly lastSpokenResponse=signal('');
  readonly guardIcon = ShieldCheck; readonly ragIcon = Database; readonly toolsIcon = Wrench;
  readonly verifyIcon = BadgeCheck; readonly approvalIcon = UserCheck;
  readonly capabilities = [
    { id:'safety',label:'SAFETY',icon:ShieldCheck,route:'/sheet/Safety Observations (BBS)' },{ id:'compliance',label:'COMPLIANCE',icon:Scale,route:'/sheet/Legal Compliance Register' },
    { id:'risk',label:'RISK',icon:TriangleAlert,route:'/sheet/HIRA Register' },{ id:'operations',label:'OPERATIONS',icon:Factory,route:'/portfolio' },
    { id:'people',label:'PEOPLE',icon:Users,route:'/sheet/Training & Competency' },{ id:'permits',label:'PERMITS',icon:FileCheck2,route:'/sheet/Permit to Work Register' },
    { id:'knowledge',label:'KNOWLEDGE',icon:BookOpen,route:'/sheet/Document Control' },{ id:'approvals',label:'APPROVALS',icon:BadgeCheck,route:null },
  ];
  readonly selected=signal<string|null>(null);private returnFocus:HTMLElement|null=null;
  readonly state=computed<YvyVisualState>(()=>this.mapLiveState());
  prompt = '';
  readonly activeCapability = computed(() => this.state().activeCapability);
  readonly snapshot=computed(()=>this.agent.latest());readonly trace=computed(()=>this.snapshot()?.executionTrace);
  readonly executedStages=computed(()=>{const route=this.trace()?.route??[];const stages=['guard'];if(this.snapshot()?.toolsUsed.length)stages.push('tools');if(this.snapshot()?.ragUsed)stages.push('rag');if(route.includes('verify'))stages.push('verify');if(this.snapshot()?.approvalRequest)stages.push('approval');return stages;});
  readonly drawerTitle=computed(()=>({core:'YvY Agent Overview',alerts:'YvY Attention Center',guard:'AI Guard',tools:'Operational Tools',rag:'RAG Engine',verify:'Semantic Verification',approval:'Human Approval',response:'AI Response',safety:'Safety',compliance:'Compliance',risk:'Risk',operations:'Operations',people:'People',permits:'Permits',knowledge:'Knowledge',approvals:'Approvals'}[this.selected()??'']??'YvY Details'));

  constructor(){let previous:string|null|undefined;effect(()=>{const id=this.auth.user()?.userId??null;if(id!==previous){previous=id;this.alerts.resetVoiceSession();this.speechSynthesis.stop();this.speechRecognition.cancel();this.proactiveVoiceQueue.clear();this.voiceConversation.set([]);this.lastSpokenResponse.set('');this.voiceStatus.set('idle');}},{allowSignalWrites:true});effect(()=>{if(this.speechSynthesis.ready()&&!this.speechSynthesis.busy())this.drainProactiveVoice();},{allowSignalWrites:true});}
  ngOnInit(){void this.agent.initialize();void this.refreshAttention();this.stopContinuousAttention=this.alerts.startContinuousAttention(()=>this.afterAttentionRefresh());}
  ngOnDestroy(){this.stopContinuousAttention();this.speechSynthesis.stop();this.speechRecognition.cancel();this.proactiveVoiceQueue.clear();}

  capabilityState(id:string):'inactive'|'active'|'success'|'warning'{
    if((id==='approvals'&&this.alerts.critical())||(id==='operations'&&this.alerts.high()))return 'warning';
    if(this.state().agentState==='error' && id==='risk') return 'warning';
    if(this.trace()?.verification?.status==='VERIFIED' && (id==='safety'||id==='approvals')) return 'success';
    if(id==='knowledge'&&this.snapshot()?.ragUsed)return 'success';if(id==='operations'&&this.snapshot()?.toolsUsed.length)return 'success';
    return this.activeCapability()===id?'active':'inactive';
  }
  stageActive(stage:YvyWorkflowStage){return this.state().activeWorkflowStage===stage;}
  async submit(){const text=this.prompt.trim();if(!text)return;this.prompt='';await this.agent.send(text);}
  askAboutAlert(alert:YvyAlert){
    this.prompt=`Explain the ${alert.severity.toLowerCase()} alert ${alert.sourceId}: ${alert.summary}`;
    this.closeDetails();
    queueMicrotask(()=>document.getElementById('yvy-command')?.focus());
  }
  setAlertPreference(key:'criticalVoice'|'highVoice'|'routineReminders'|'desktopNotifications',value:boolean){this.alerts.setPreferences({...this.alerts.preferences(),[key]:value});}
  async startVoice(){
    if(this.voiceStatus()==='listening')return;if(this.voiceStatus()==='speaking'){this.speechSynthesis.stop();this.voiceStatus.set('interrupted');}
    this.voiceError.set('');this.voiceStatus.set('requesting-permission');
    const voiceOwner=this.auth.user()?.userId;try{this.voiceStatus.set('listening');const result=await this.speechRecognition.listen();if(voiceOwner!==this.auth.user()?.userId)return;this.voiceStatus.set('transcribing');const metadata=this.speechRecognition.resolveMetadata(result);this.agent.voiceMetadata.set(metadata);this.voiceConversation.update(turns=>[...turns,this.turn('user',metadata.effectiveResponseLanguage,result.transcript)].slice(-20));this.prompt=result.transcript;this.voiceStatus.set('processing');const completed=await this.agent.send(result.transcript,metadata);if(voiceOwner!==this.auth.user()?.userId)return;if(completed)this.speakVerified();else this.voiceStatus.set('error');}
    catch(error){const code=error instanceof Error?error.message:'STT_FAILED';if(code==='CANCELLED'){this.voiceStatus.set('idle');return;}const language=this.agent.voiceMetadata()?.effectiveResponseLanguage??'en';this.voiceError.set(this.friendlyVoiceError(code,language));this.voiceStatus.set('error');}
  }
  stopListening(){this.voiceStatus.set('transcribing');this.speechRecognition.stop();}
  cancelVoice(){this.speechRecognition.cancel();this.speechSynthesis.stop();this.voiceStatus.set('idle');this.drainProactiveVoice();}
  stopSpeaking(){this.speechSynthesis.stop();this.voiceStatus.set('idle');this.drainProactiveVoice();}
  toggleMute(){const value=!this.muted();this.muted.set(value);this.speechSynthesis.setMuted(value);if(value&&this.voiceStatus()==='speaking')this.voiceStatus.set('idle');}
  replay(){if(this.speechSynthesis.replay(()=>this.voiceStatus.set('idle')))this.voiceStatus.set('speaking');}
  openDetails(kind:string,event?:Event){this.returnFocus=(event?.currentTarget as HTMLElement)||document.activeElement as HTMLElement;this.selected.set(kind);}
  closeDetails(){this.selected.set(null);queueMicrotask(()=>this.returnFocus?.focus());}
  capability(id:string){return this.capabilities.find(item=>item.id===id);}
  readonly canApprove=computed(()=>this.auth.user()?.permissions.includes('HITL_APPROVE')===true);

  private mapLiveState():YvyVisualState{
    const runtime=this.agent.runtimeState(),snapshot=this.agent.latest(),approval=this.agent.approval()??snapshot?.approvalRequest;
    let agentState:YvyAgentVisualState='ready',activeWorkflowStage:YvyWorkflowStage=null,activeCapability:string|undefined;
    if(this.voiceStatus()==='listening')agentState='listening';else if(this.voiceStatus()==='transcribing')agentState='transcribing';else if(this.voiceStatus()==='processing'&&runtime==='idle')agentState='understanding';else if(this.voiceStatus()==='speaking')agentState='speaking';else if(this.voiceStatus()==='interrupted')agentState='interrupted';
    else if(runtime==='analysing'){agentState='analysing';activeWorkflowStage='guard';activeCapability='safety';}
    else if(runtime==='using-tool'){agentState='using-tool';activeWorkflowStage='tools';activeCapability='operations';}
    else if(runtime==='streaming'){agentState='analysing';}
    else if(runtime==='error'||snapshot?.status==='FAILED'){agentState='error';activeCapability='risk';}
    else if(approval?.status==='PENDING'){agentState='waiting-approval';activeWorkflowStage='approval';activeCapability='approvals';}
    else if(this.alerts.critical()){agentState='critical-alert';activeCapability='approvals';}
    else if(this.alerts.high()){agentState='high-alert';activeCapability='operations';}
    else if(this.alerts.active().length){agentState='attention';}
    const verificationStatus=snapshot?.executionTrace?.verification?.status??'IDLE';
    const approvalStatus=approval?.status==='CANCELLED'?'EXPIRED':approval?.status??'NOT_REQUIRED';
    return {agentState,activeCapability,activeWorkflowStage,verificationStatus,approvalStatus};
  }
  private speakVerified(){const metadata=this.agent.voiceMetadata(),snapshot=this.agent.latest(),verification=snapshot?.executionTrace?.verification?.status,approval=this.agent.approval();if(!metadata){this.voiceStatus.set('idle');this.drainProactiveVoice();return;}const route=snapshot?.executionTrace?.route??[];const safeFinalResponse=verification==='VERIFIED'||approval?.status==='PENDING'||route.includes('refuse')||route.includes('clarify')||(snapshot?.errorCode==='AI_SEMANTIC_VERIFICATION_FAILED'&&route.includes('finalize_failure'));if(!safeFinalResponse||!this.agent.answer()){this.voiceStatus.set('idle');this.drainProactiveVoice();return;}const response=this.spokenFormatter.format(this.agent.answer(),metadata.effectiveResponseLanguage);this.lastSpokenResponse.set(response.spokenResponse);this.voiceConversation.update(turns=>[...turns,this.turn('assistant',metadata.effectiveResponseLanguage,response.displayResponse,response.spokenResponse,verification)].slice(-20));if(this.speechSynthesis.speak(response.spokenResponse,metadata.effectiveResponseLanguage,()=>{this.voiceStatus.set('idle');this.drainProactiveVoice();},()=>{this.voiceError.set(this.friendlyVoiceError('TTS_FAILED',metadata.effectiveResponseLanguage));this.voiceStatus.set('idle');this.drainProactiveVoice();}))this.voiceStatus.set('speaking');else{this.voiceStatus.set('idle');this.drainProactiveVoice();}}
  private turn(role:'user'|'assistant',language:VoiceConversationTurn['language'],text:string,spokenText?:string,verificationStatus?:string):VoiceConversationTurn{return {id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,role,mode:'voice',language,text,spokenText,verificationStatus,timestamp:new Date().toISOString()};}
  private friendlyVoiceError(code:string,language:VoiceConversationTurn['language']){const messages={en:{miss:"I didn't catch that. Could you say it again?",unavailable:'Voice is temporarily unavailable. You can continue by text.'},pt:{miss:'Não entendi. Pode dizer novamente?',unavailable:'A voz está temporariamente indisponível. Você pode continuar por texto.'},es:{miss:'No entendí. ¿Puedes repetirlo?',unavailable:'La voz no está disponible temporalmente. Puedes continuar por texto.'},fr:{miss:"Je n’ai pas compris. Pouvez-vous répéter ?",unavailable:'La voix est temporairement indisponible. Vous pouvez continuer par écrit.'},de:{miss:'Ich habe das nicht verstanden. Können Sie es wiederholen?',unavailable:'Die Sprachausgabe ist vorübergehend nicht verfügbar. Sie können per Text fortfahren.'}};return code==='NO_SPEECH'?messages[language].miss:messages[language].unavailable;}
  private async refreshAttention(){if(await this.alerts.refresh())this.afterAttentionRefresh();}
  private afterAttentionRefresh(){const active=this.alerts.active();this.agent.setActiveAlertContext(active);this.inspector.recordAlertEvents(this.alerts.events());this.inspector.recordAttentionScheduler(this.alerts.scheduler());const candidates=this.alerts.voiceCandidates();if(candidates.length){const critical=candidates.filter(a=>a.severity==='CRITICAL'),selected=critical.length?critical:candidates.filter(a=>a.severity==='HIGH'),first=selected[0],language=this.agent.voiceMetadata()?.effectiveResponseLanguage??'en',count=selected.length,away=this.alerts.returnSummary().total>0;const lines={en:`${away?'While you were away, ':''}${count} ${critical.length?'critical':'high-priority'} item${count===1?' requires':'s require'} your attention. The verified details are on screen.`,pt:`${away?'Enquanto você esteve fora, ':''}${count===1?'um item':'há '+count+' itens'} ${critical.length?'crítico':'de alta prioridade'} requer${count===1?'':'em'} sua atenção. Os detalhes verificados estão na tela.`,es:`${away?'Mientras no estaba, ':''}${count} elemento${count===1?'':'s'} ${critical.length?'crítico':'de alta prioridad'} requiere${count===1?'':'n'} atención.`,fr:`${away?'Pendant votre absence, ':''}${count} élément${count===1?'':'s'} ${critical.length?'critique':'prioritaire'} nécessite${count===1?'':'nt'} votre attention.`,de:`${away?'Während Ihrer Abwesenheit sind ':''}${count} ${critical.length?'kritische':'wichtige'} Hinweis${count===1?'':'e'} verfügbar.`};this.proactiveVoiceQueue.enqueue({coveredAlerts:selected,id:first.id,priority:critical.length?'CRITICAL':'HIGH',alert:first,spokenText:lines[language],language});}this.drainProactiveVoice();}
  private drainProactiveVoice(){if(!this.auth.user()||!this.speechSynthesis.ready()||this.speechSynthesis.busy()||this.muted()||this.voiceStatus()!=='idle'||this.agent.loading())return;const entry=this.proactiveVoiceQueue.shift();if(!entry)return;if(this.speechSynthesis.speak(entry.spokenText,entry.language,()=>{this.voiceStatus.set('idle');void Promise.all((entry.coveredAlerts??[entry.alert]).map(alert=>this.alerts.markVoiceSpoken(alert.id,alert.voiceClaimToken)));this.drainProactiveVoice();},()=>{this.voiceStatus.set('idle');this.drainProactiveVoice();}))this.voiceStatus.set('speaking');}
}
