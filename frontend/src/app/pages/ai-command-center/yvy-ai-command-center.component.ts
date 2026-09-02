import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { SpeechSynthesisService } from './voice/speech-synthesis.service';
import { languageName } from './voice/language-resolution';
import type { VoiceStatus } from './voice/voice.types';
import type { VoiceConversationTurn } from './voice/voice.types';
import { SpokenResponseFormatterService } from './voice/spoken-response-formatter.service';

@Component({
  selector: 'app-yvy-ai-command-center', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, YvyAiCoreComponent, YvyCapabilityNodeComponent, YvyHudPanelComponent, YvyWorkflowComponent, YvyResponsePanelComponent, YvyDetailsDrawerComponent],
  templateUrl: './yvy-ai-command-center.component.html', styleUrl: './yvy-ai-command-center.component.scss',
})
export class YvyAiCommandCenterComponent implements OnInit {
  readonly agent=inject(YvyCommandCenterAgentService);readonly auth=inject(AuthService);readonly speechRecognition=inject(SpeechRecognitionService);readonly speechSynthesis=inject(SpeechSynthesisService);readonly spokenFormatter=inject(SpokenResponseFormatterService);
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
  readonly drawerTitle=computed(()=>({core:'YvY Agent Overview',guard:'AI Guard',tools:'Operational Tools',rag:'RAG Engine',verify:'Semantic Verification',approval:'Human Approval',response:'AI Response',safety:'Safety',compliance:'Compliance',risk:'Risk',operations:'Operations',people:'People',permits:'Permits',knowledge:'Knowledge',approvals:'Approvals'}[this.selected()??'']??'YvY Details'));

  ngOnInit(){void this.agent.initialize();}

  capabilityState(id:string):'inactive'|'active'|'success'|'warning'{
    if(this.state().agentState==='error' && id==='risk') return 'warning';
    if(this.trace()?.verification?.status==='VERIFIED' && (id==='safety'||id==='approvals')) return 'success';
    if(id==='knowledge'&&this.snapshot()?.ragUsed)return 'success';if(id==='operations'&&this.snapshot()?.toolsUsed.length)return 'success';
    return this.activeCapability()===id?'active':'inactive';
  }
  stageActive(stage:YvyWorkflowStage){return this.state().activeWorkflowStage===stage;}
  async submit(){const text=this.prompt.trim();if(!text)return;this.prompt='';await this.agent.send(text);}
  async startVoice(){
    if(this.voiceStatus()==='listening')return;if(this.voiceStatus()==='speaking'){this.speechSynthesis.stop();this.voiceStatus.set('interrupted');}
    this.voiceError.set('');this.voiceStatus.set('requesting-permission');
    try{this.voiceStatus.set('listening');const result=await this.speechRecognition.listen();this.voiceStatus.set('transcribing');const metadata=this.speechRecognition.resolveMetadata(result);this.agent.voiceMetadata.set(metadata);this.voiceConversation.update(turns=>[...turns,this.turn('user',metadata.effectiveResponseLanguage,result.transcript)].slice(-20));this.prompt=result.transcript;this.voiceStatus.set('processing');const completed=await this.agent.send(result.transcript,metadata);if(completed)this.speakVerified();else this.voiceStatus.set('error');}
    catch(error){const code=error instanceof Error?error.message:'STT_FAILED';if(code==='CANCELLED'){this.voiceStatus.set('idle');return;}const language=this.agent.voiceMetadata()?.effectiveResponseLanguage??'en';this.voiceError.set(this.friendlyVoiceError(code,language));this.voiceStatus.set('error');}
  }
  stopListening(){this.voiceStatus.set('transcribing');this.speechRecognition.stop();}
  cancelVoice(){this.speechRecognition.cancel();this.speechSynthesis.stop();this.voiceStatus.set('idle');}
  stopSpeaking(){this.speechSynthesis.stop();this.voiceStatus.set('idle');}
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
    const verificationStatus=snapshot?.executionTrace?.verification?.status??'IDLE';
    const approvalStatus=approval?.status==='CANCELLED'?'EXPIRED':approval?.status??'NOT_REQUIRED';
    return {agentState,activeCapability,activeWorkflowStage,verificationStatus,approvalStatus};
  }
  private speakVerified(){const metadata=this.agent.voiceMetadata(),verification=this.agent.latest()?.executionTrace?.verification?.status,approval=this.agent.approval();if(!metadata){this.voiceStatus.set('idle');return;}const safe=verification==='VERIFIED'||approval?.status==='PENDING';if(!safe||!this.agent.answer()){this.voiceStatus.set('idle');return;}const response=this.spokenFormatter.format(this.agent.answer(),metadata.effectiveResponseLanguage);this.lastSpokenResponse.set(response.spokenResponse);this.voiceConversation.update(turns=>[...turns,this.turn('assistant',metadata.effectiveResponseLanguage,response.displayResponse,response.spokenResponse,verification)].slice(-20));if(this.speechSynthesis.speak(response.spokenResponse,metadata.effectiveResponseLanguage,()=>this.voiceStatus.set('idle'),()=>{this.voiceError.set(this.friendlyVoiceError('TTS_FAILED',metadata.effectiveResponseLanguage));this.voiceStatus.set('idle');}))this.voiceStatus.set('speaking');else this.voiceStatus.set('idle');}
  private turn(role:'user'|'assistant',language:VoiceConversationTurn['language'],text:string,spokenText?:string,verificationStatus?:string):VoiceConversationTurn{return {id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,role,mode:'voice',language,text,spokenText,verificationStatus,timestamp:new Date().toISOString()};}
  private friendlyVoiceError(code:string,language:VoiceConversationTurn['language']){const messages={en:{miss:"I didn't catch that. Could you say it again?",unavailable:'Voice is temporarily unavailable. You can continue by text.'},pt:{miss:'Não entendi. Pode dizer novamente?',unavailable:'A voz está temporariamente indisponível. Você pode continuar por texto.'},es:{miss:'No entendí. ¿Puedes repetirlo?',unavailable:'La voz no está disponible temporalmente. Puedes continuar por texto.'},fr:{miss:"Je n’ai pas compris. Pouvez-vous répéter ?",unavailable:'La voix est temporairement indisponible. Vous pouvez continuer par écrit.'},de:{miss:'Ich habe das nicht verstanden. Können Sie es wiederholen?',unavailable:'Die Sprachausgabe ist vorübergehend nicht verfügbar. Sie können per Text fortfahren.'}};return code==='NO_SPEECH'?messages[language].miss:messages[language].unavailable;}
}
