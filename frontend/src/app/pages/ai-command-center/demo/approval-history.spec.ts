import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth.service';
import { YvyCommandCenterAgentService } from '../yvy-command-center-agent.service';

describe('Resolved approval history',()=>{
  it('retains the actual resolved status in its own card after another request becomes active',async()=>{
    TestBed.configureTestingModule({providers:[provideHttpClient()]});
    TestBed.inject(AuthService).user.set({userId:'owner',email:'demo@example.invalid',displayName:'Demo',role:'APPROVER',permissions:['AI_USE','HITL_APPROVE'],allowedProjectIds:['DEMO-LIS-01']});
    const agent=TestBed.inject(YvyCommandCenterAgentService);TestBed.flushEffects();
    const pending:any={approvalId:'approval',threadId:'thread',status:'PENDING'};
    agent.approval.set(pending);agent.timeline.set([{id:'card',role:'YVY',text:'Requires human decision',status:'COMPLETE',createdAt:new Date().toISOString(),snapshot:{threadId:'thread',approvalRequest:pending} as any}]);
    spyOn(window,'fetch').and.resolveTo(new Response(JSON.stringify({approval:{...pending,status:'APPROVED'}}),{status:200}));
    expect(await agent.resolveApproval('approve')).toBeTrue();
    agent.approval.set(null);
    expect(agent.timeline()[0].snapshot?.approvalRequest?.status).toBe('APPROVED');
    expect(pending.status).toBe('PENDING');
  });
});
