import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OperationalOverviewComponent } from './operational-overview.component';

describe('Independent operational evidence cards',()=>{
  it('opens only the selected evidence without stretching its siblings',()=>{
    TestBed.configureTestingModule({imports:[OperationalOverviewComponent],providers:[provideRouter([])]});
    const fixture=TestBed.createComponent(OperationalOverviewComponent);
    fixture.componentInstance.snapshot={executionTrace:{timestamp:'2026-09-14T10:00:00Z',intent:{intent:'OPERATIONAL_OVERVIEW'},verification:{status:'VERIFIED'},guardrail:{status:'PASS'},rag:{status:'NOT_USED'},tools:[
      {name:'list_actions',status:'COMPLETED',resultStatus:'SUCCESS_WITH_DATA',presentationFacts:{pendingCount:4}},
      {name:'list_incidents',status:'COMPLETED',resultStatus:'SUCCESS_WITH_DATA',presentationFacts:{openCount:2}},
    ]}} as any;
    fixture.nativeElement.style.width='900px';fixture.detectChanges();
    const cards=Array.from(fixture.nativeElement.querySelectorAll('.result-card')) as HTMLElement[];
    expect(cards.length).toBe(2);
    const closedHeight=cards[1].getBoundingClientRect().height;
    cards[0].querySelector('button')!.click();fixture.detectChanges();
    expect(cards[0].querySelector('app-evidence-view')).not.toBeNull();
    expect(cards[1].querySelector('app-evidence-view')).toBeNull();
    expect(cards[1].querySelector('button')!.getAttribute('aria-expanded')).toBe('false');
    expect(cards[1].getBoundingClientRect().height).toBe(closedHeight);
    expect(cards[0].getBoundingClientRect().height).toBeGreaterThan(closedHeight);
    cards[1].querySelector('button')!.click();fixture.detectChanges();
    expect(cards[1].querySelector('app-evidence-view')).not.toBeNull();
    cards[0].querySelector('button')!.click();fixture.detectChanges();
    expect(cards[0].querySelector('app-evidence-view')).toBeNull();
    expect(cards[1].querySelector('app-evidence-view')).not.toBeNull();
    fixture.destroy();
  });
});
