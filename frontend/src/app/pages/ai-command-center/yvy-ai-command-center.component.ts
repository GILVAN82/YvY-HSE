import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Send, ShieldCheck, Scale, TriangleAlert, Factory, Users, FileCheck2, BookOpen, BadgeCheck, Wrench, Database, UserCheck } from 'lucide-angular';
import { YvyAiCoreComponent } from './components/yvy-ai-core.component';
import { YvyCapabilityNodeComponent } from './components/yvy-capability-node.component';
import { YvyHudPanelComponent } from './components/yvy-hud-panel.component';
import { YvyWorkflowComponent } from './components/yvy-workflow.component';
import { YvyResponsePanelComponent } from './components/yvy-response-panel.component';
import { YvyDetailsDrawerComponent } from './components/yvy-details-drawer.component';
import { YvyCommandCenterAgentService } from './yvy-command-center-agent.service';
import { AuthService } from '../../core/auth.service';
import type { YvyAgentVisualState, YvyVisualState, YvyWorkflowStage } from './yvy-visual-state';

@Component({
  selector: 'app-yvy-ai-command-center', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, YvyAiCoreComponent, YvyCapabilityNodeComponent, YvyHudPanelComponent, YvyWorkflowComponent, YvyResponsePanelComponent, YvyDetailsDrawerComponent],
  templateUrl: './yvy-ai-command-center.component.html', styleUrl: './yvy-ai-command-center.component.scss',
})
export class YvyAiCommandCenterComponent implements OnInit {
  readonly agent=inject(YvyCommandCenterAgentService);readonly auth=inject(AuthService);
  readonly sendIcon = Send;
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
  openDetails(kind:string,event?:Event){this.returnFocus=(event?.currentTarget as HTMLElement)||document.activeElement as HTMLElement;this.selected.set(kind);}
  closeDetails(){this.selected.set(null);queueMicrotask(()=>this.returnFocus?.focus());}
  capability(id:string){return this.capabilities.find(item=>item.id===id);}
  readonly canApprove=computed(()=>this.auth.user()?.permissions.includes('HITL_APPROVE')===true);

  private mapLiveState():YvyVisualState{
    const runtime=this.agent.runtimeState(),snapshot=this.agent.latest(),approval=this.agent.approval()??snapshot?.approvalRequest;
    let agentState:YvyAgentVisualState='ready',activeWorkflowStage:YvyWorkflowStage=null,activeCapability:string|undefined;
    if(runtime==='analysing'){agentState='analysing';activeWorkflowStage='guard';activeCapability='safety';}
    else if(runtime==='using-tool'){agentState='using-tool';activeWorkflowStage='tools';activeCapability='operations';}
    else if(runtime==='streaming'){agentState='analysing';}
    else if(runtime==='error'||snapshot?.status==='FAILED'){agentState='error';activeCapability='risk';}
    else if(approval?.status==='PENDING'){agentState='waiting-approval';activeWorkflowStage='approval';activeCapability='approvals';}
    const verificationStatus=snapshot?.executionTrace?.verification?.status??'IDLE';
    const approvalStatus=approval?.status==='CANCELLED'?'EXPIRED':approval?.status??'NOT_REQUIRED';
    return {agentState,activeCapability,activeWorkflowStage,verificationStatus,approvalStatus};
  }
}
