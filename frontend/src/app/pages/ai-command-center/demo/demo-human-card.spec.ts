import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { YvyAiCommandCenterComponent } from '../yvy-ai-command-center.component';

describe('Conversation approval cards during a presentation',()=>{
  it('routes the current card through the live demo decision and keeps historical cards inactive',()=>{
    TestBed.configureTestingModule({imports:[YvyAiCommandCenterComponent],providers:[provideHttpClient(),provideRouter([])]});
    const auth=TestBed.inject(AuthService);auth.user.set({userId:'presenter',email:'demo@example.invalid',displayName:'Demo',role:'APPROVER',permissions:['AI_USE','HITL_APPROVE'],allowedProjectIds:['DEMO-LIS-01']});
    const f=TestBed.createComponent(YvyAiCommandCenterComponent),c=f.componentInstance;f.detectChanges();
    const approval:any={approvalId:'current',threadId:'request',actionType:'LOTO_SAFETY_EXECUTION',riskLevel:'CRITICAL',status:'PENDING'};
    const context:any={demoSessionId:'session',requestInstanceId:'request',approvalId:'current',resourceId:'current',projectId:'DEMO-LIS-01',status:'PENDING',decisionMadeDuringCurrentDemo:false};
    c.demo.active.set(true);c.demo.state.set('WAITING_FOR_HUMAN');c.demo.index.set(4);c.demo.humanContext.set(context);c.agent.approval.set(approval);
    const snapshot=(a:any)=>({runId:'run-'+a.approvalId,threadId:a.threadId,status:'AWAITING_HUMAN_APPROVAL',toolsUsed:[],citations:[],approvalRequest:a});
    c.agent.timeline.set([
      {id:'old',role:'YVY',text:'Previous request',status:'COMPLETE',createdAt:new Date().toISOString(),snapshot:snapshot({...approval,approvalId:'old',status:'APPROVED'}) as any},
      {id:'current',role:'YVY',text:'Current request',status:'COMPLETE',createdAt:new Date().toISOString(),snapshot:snapshot(approval) as any},
    ]);f.detectChanges();
    const cards=f.nativeElement.querySelectorAll('.approval-card');expect(cards.length).toBe(2);
    expect(cards[0].querySelectorAll('button').length).toBe(0);expect(cards[0].textContent).toContain('APPROVED');
    const demoDecision=spyOn(c.demo,'decide').and.resolveTo(),canonical=spyOn(c.agent,'resolveApproval').and.resolveTo(true);
    cards[1].querySelector('button').click();expect(demoDecision).toHaveBeenCalledOnceWith('approve');expect(canonical).not.toHaveBeenCalled();
    c.demo.active.set(false);f.detectChanges();cards[1].querySelector('button').click();expect(canonical).toHaveBeenCalledOnceWith('approve');
    f.destroy();
  });
});
