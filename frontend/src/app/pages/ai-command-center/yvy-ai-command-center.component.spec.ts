import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { YvyAiCommandCenterComponent } from './yvy-ai-command-center.component';
import { YvyAiCoreComponent } from './components/yvy-ai-core.component';
import { YvyCapabilityNodeComponent } from './components/yvy-capability-node.component';
import { YvyResponsePanelComponent } from './components/yvy-response-panel.component';
import { NAVIGATION } from '../../core/navigation.config';

describe('YvyAiCommandCenterComponent', () => {
  let fixture: ComponentFixture<YvyAiCommandCenterComponent>;
  let component: YvyAiCommandCenterComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [YvyAiCommandCenterComponent] }).compileComponents();
    fixture = TestBed.createComponent(YvyAiCommandCenterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the Command Center with the dominant YvY core', () => {
    expect(fixture.nativeElement.querySelector('.command-center')).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(YvyAiCoreComponent))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('HSE Intelligence Agent');
  });

  it('renders all eight reusable capability nodes', () => {
    expect(fixture.debugElement.queryAll(By.directive(YvyCapabilityNodeComponent)).length).toBe(8);
  });

  it('changes visual state and independently highlights workflow and capability state', () => {
    component.setDemoState('retrieving');
    fixture.detectChanges();
    expect(component.state().agentState).toBe('retrieving');
    expect(component.state().activeWorkflowStage).toBe('rag');
    expect(component.capabilityState('knowledge')).toBe('active');
    expect(fixture.nativeElement.querySelector('.command-center').dataset.agentState).toBe('retrieving');
  });

  it('supports verification and approval visual contracts without fake execution', () => {
    component.setDemoState('waiting-approval');
    expect(component.state().approvalStatus).toBe('PENDING');
    component.setDemoState('verified');
    expect(component.state().verificationStatus).toBe('VERIFIED');
    expect(component.state().approvalStatus).toBe('APPROVED');
  });

  it('keeps the response panel in an honest empty or prepared-question state', () => {
    const response = fixture.debugElement.query(By.directive(YvyResponsePanelComponent));
    expect(response.componentInstance.state).toBe('empty');
    component.prompt = 'Show open HSE actions';
    component.previewQuestion();
    fixture.detectChanges();
    expect(response.componentInstance.state).toBe('question');
    expect(fixture.nativeElement.textContent).toContain('Live execution is not connected');
  });

  it('makes the AI Command Center the first primary navigation destination', () => {
    expect(NAVIGATION[0].defaultRoute).toBe('/home');
    expect(NAVIGATION[0].items[0].label).toBe('AI Command Center');
    expect(NAVIGATION[0].items[0].route).toBe('/home');
  });
});
