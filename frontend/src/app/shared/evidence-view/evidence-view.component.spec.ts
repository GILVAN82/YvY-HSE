import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResponseEvidenceComponent } from './response-evidence.component';
import { EvidenceViewComponent } from './evidence-view.component';
import { presentOperationalEvidence, presentResponseEvidence } from './evidence.presenter';

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
  it('renders compact approved sources without raw fields or URL body text',()=>{
    const fixture=TestBed.createComponent(EvidenceViewComponent);
    const raw={sourceId:'private-source',chunkId:'private-chunk',content_state:'approved',embedding:[0.2],rrfScore:0.9,vectorScore:0.8,retrievedAt:'internal-time',metadata:{secret:true}};
    const documents=[{...raw,title:'Approved isolation procedure',citation:JSON.stringify(raw),passage:'Verify isolation before work. Do not proceed if isolation cannot be confirmed.',jurisdiction:'United Kingdom',version:'2026',url:'https://example.org/guidance?reference=long-source-reference'},
      {...raw,title:'Second approved source',citation:'chunkId: private',passage:'Record the isolation check.',jurisdiction:'unknown',version:'n/a',url:'javascript:alert(1)'}];
    fixture.componentInstance.model=presentResponseEvidence({...snapshot,executionTrace:{...snapshot.executionTrace,verification:{status:'VERIFIED'}},evidencePresentation:{operational:[],documents}},'Confirm isolation before proceeding.')[0];fixture.detectChanges();
    const text=fixture.nativeElement.textContent;
    for(const expected of ['Supporting evidence','Verified','Conclusion','Confirm isolation before proceeding.','Approved source','Approved isolation procedure','Relevant guidance','Do not proceed if isolation cannot be confirmed.','United Kingdom','2026','View source'])expect(text).toContain(expected);
    expect(text).not.toMatch(/sourceId|chunkId|content_state|embedding|rrfScore|vectorScore|retrievedAt|metadata|private|[{}]|https?:|long-source-reference|unknown|n\/a/);
    const cards=fixture.nativeElement.querySelectorAll('.evidence-items>li');expect(cards.length).toBe(2);expect(cards[1].textContent).not.toMatch(/Jurisdiction|Version/);
    const links=fixture.nativeElement.querySelectorAll('a');expect(links.length).toBe(1);expect(links[0].getAttribute('href')).toBe(documents[0].url);expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
  });
  it('rejects technical text even when embedded in display fields, without mutating evidence',()=>{
    for(const raw of ['sourceId: private','documentId: private','chunkId: private','content_state: approved','embedding metadata: 123','RRF score: 0.8','vector score: 0.9','retrievedAt: internal','{"raw":"JSON"}']){
      const data={...snapshot,evidencePresentation:{operational:[],documents:[{title:raw,citation:raw,passage:raw,jurisdiction:raw,version:raw}]}};
      const before=JSON.stringify(data);const fixture=TestBed.createComponent(EvidenceViewComponent);fixture.componentInstance.model=presentResponseEvidence(data,raw)[0];fixture.detectChanges();
      expect(fixture.nativeElement.textContent).not.toContain(raw);expect(JSON.stringify(data)).toBe(before);fixture.destroy();
    }
  });
  it('does not turn a long passage into a partial instruction or a document dump',()=>{
    const passage='Verify all isolation points carefully. '.repeat(30)+'Do not proceed unless every point is confirmed.';
    const fixture=TestBed.createComponent(EvidenceViewComponent);fixture.componentInstance.model=presentResponseEvidence({...snapshot,evidencePresentation:{operational:[],documents:[{title:'Procedure',citation:'[Procedure]',passage,url:'https://example.org'}]}},'Check isolation.')[0];fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('blockquote').textContent).toContain('full context');expect(fixture.nativeElement.textContent).not.toContain('Verify all isolation points');expect(fixture.nativeElement.querySelector('a')).not.toBeNull();
  });
});
