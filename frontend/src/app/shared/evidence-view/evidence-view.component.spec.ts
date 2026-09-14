import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResponseEvidenceComponent } from './response-evidence.component';
import { EvidenceViewComponent } from './evidence-view.component';
import { presentOperationalEvidence } from './evidence.presenter';

describe('Shared Evidence View rendering',()=>{
  beforeEach(()=>TestBed.configureTestingModule({imports:[ResponseEvidenceComponent,EvidenceViewComponent],providers:[provideRouter([])]}));
  const snapshot:any={threadId:'t',ragUsed:true,citations:[],executionTrace:{timestamp:'2026-09-14T10:00:00Z',tools:[],verification:{status:'PARTIALLY_VERIFIED',reasons:['SUCCESS_WITH_DATA Filters: {} recordCount']},rag:{status:'OK'}},evidencePresentation:{operational:[],documents:[{title:'Approved procedure',citation:'[LOTO]',passage:'Check the isolation.',url:'https://www.osha.gov'}]}};
  it('opens source traceability and partial limitations without exposing technical metadata',()=>{
    const fixture=TestBed.createComponent(ResponseEvidenceComponent);fixture.componentInstance.snapshot=snapshot;fixture.componentInstance.conclusion='Check isolation before work.';fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.evidence')).toBeNull();fixture.nativeElement.querySelector('button').click();fixture.detectChanges();
    const text=fixture.nativeElement.textContent;expect(text).toContain('What is available');expect(text).toContain('What is missing');expect(text).toContain('Partially verified');expect(text).toContain('Check the isolation.');expect(text).not.toMatch(/SUCCESS_WITH_DATA|SUCCESS_NO_DATA|Filters:|recordCount|RRF score|embedding|\{\}/);
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('https://www.osha.gov/');expect(text).not.toContain('Project scope');expect(text).not.toContain('Jurisdiction');
    fixture.componentInstance.language='pt';fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('O que falta');expect(fixture.nativeElement.textContent).toContain('Parcialmente verificado');
  });
  it('formats a supplied operational timestamp and qualifies freshness',()=>{
    const fixture=TestBed.createComponent(EvidenceViewComponent);fixture.componentInstance.model=presentOperationalEvidence({name:'list_incidents',status:'COMPLETED',resultStatus:'SUCCESS_NO_DATA',presentationFacts:{openCount:0}},{...snapshot,ragUsed:false,executionTrace:{...snapshot.executionTrace,verification:{status:'VERIFIED'}}});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('time').getAttribute('datetime')).toBe('2026-09-14T10:00:00Z');expect(fixture.nativeElement.textContent).toContain('not a live update');expect(fixture.nativeElement.textContent).toContain('0 open');expect(fixture.nativeElement.textContent).toContain('not a retrieval failure');
  });
  it('approval action only focuses existing controls without deciding',()=>{
    const fixture=TestBed.createComponent(EvidenceViewComponent);const target=document.createElement('section');target.id='existing-approval-controls';target.tabIndex=-1;document.body.appendChild(target);
    try{const focus=spyOn(target,'focus');fixture.componentInstance.showApproval({label:'View approval',approvalTarget:target.id});expect(focus).toHaveBeenCalled();}finally{target.remove();}
  });
});
