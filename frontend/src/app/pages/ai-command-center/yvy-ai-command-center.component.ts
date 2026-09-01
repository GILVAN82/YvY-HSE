import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Send, ShieldCheck, Scale, TriangleAlert, Factory, Users, FileCheck2, BookOpen, BadgeCheck, Wrench, Database, UserCheck } from 'lucide-angular';
import { YvyAiCoreComponent } from './components/yvy-ai-core.component';
import { YvyCapabilityNodeComponent } from './components/yvy-capability-node.component';
import { YvyHudPanelComponent } from './components/yvy-hud-panel.component';
import { YvyWorkflowComponent } from './components/yvy-workflow.component';
import { YvyResponsePanelComponent } from './components/yvy-response-panel.component';
import type { YvyAgentVisualState, YvyVisualState, YvyWorkflowStage } from './yvy-visual-state';

@Component({
  selector: 'app-yvy-ai-command-center', standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, YvyAiCoreComponent, YvyCapabilityNodeComponent, YvyHudPanelComponent, YvyWorkflowComponent, YvyResponsePanelComponent],
  templateUrl: './yvy-ai-command-center.component.html', styleUrl: './yvy-ai-command-center.component.scss',
})
export class YvyAiCommandCenterComponent {
  readonly sendIcon = Send;
  readonly guardIcon = ShieldCheck; readonly ragIcon = Database; readonly toolsIcon = Wrench;
  readonly verifyIcon = BadgeCheck; readonly approvalIcon = UserCheck;
  readonly capabilities = [
    { id:'safety',label:'SAFETY',icon:ShieldCheck },{ id:'compliance',label:'COMPLIANCE',icon:Scale },
    { id:'risk',label:'RISK',icon:TriangleAlert },{ id:'operations',label:'OPERATIONS',icon:Factory },
    { id:'people',label:'PEOPLE',icon:Users },{ id:'permits',label:'PERMITS',icon:FileCheck2 },
    { id:'knowledge',label:'KNOWLEDGE',icon:BookOpen },{ id:'approvals',label:'APPROVALS',icon:BadgeCheck },
  ];
  readonly state = signal<YvyVisualState>({agentState:'ready',activeWorkflowStage:null,verificationStatus:'IDLE',approvalStatus:'NOT_REQUIRED'});
  readonly demoStates: YvyAgentVisualState[] = ['ready','analysing','retrieving','using-tool','verifying','waiting-approval','verified','error'];
  prompt = '';
  readonly activeCapability = computed(() => this.state().activeCapability);

  capabilityState(id:string):'inactive'|'active'|'success'|'warning'{
    if(this.state().agentState==='error' && id==='risk') return 'warning';
    if(this.state().agentState==='verified' && (id==='safety'||id==='approvals')) return 'success';
    return this.activeCapability()===id?'active':'inactive';
  }
  setDemoState(agentState:YvyAgentVisualState){
    const mapping:Record<YvyAgentVisualState,{cap?:string;stage:YvyWorkflowStage}>={
      ready:{stage:null},analysing:{cap:'safety',stage:'guard'},retrieving:{cap:'knowledge',stage:'rag'},
      'using-tool':{cap:'operations',stage:'tools'},verifying:{cap:'safety',stage:'verify'},
      'waiting-approval':{cap:'approvals',stage:'approval'},verified:{cap:'approvals',stage:'verify'},error:{cap:'risk',stage:'verify'},
    };
    const selected=mapping[agentState];
    this.state.set({agentState,activeCapability:selected.cap,activeWorkflowStage:selected.stage,verificationStatus:agentState==='verified'?'VERIFIED':agentState==='verifying'?'VERIFYING':agentState==='error'?'SAFETY_BLOCKED':'IDLE',approvalStatus:agentState==='waiting-approval'?'PENDING':agentState==='verified'?'APPROVED':'NOT_REQUIRED'});
  }
  stageActive(stage:YvyWorkflowStage){return this.state().activeWorkflowStage===stage;}
  previewQuestion(){ if(!this.prompt.trim()) return; this.state.update(s=>({...s,agentState:'ready'})); }
}
