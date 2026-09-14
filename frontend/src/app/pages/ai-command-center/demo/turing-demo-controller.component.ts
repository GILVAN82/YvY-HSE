import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuringDemoService } from './turing-demo.service';
import { AgentInspectorComponent } from '../../agent-inspector/agent-inspector.component';
import { EvidenceViewComponent } from '../../../shared/evidence-view/evidence-view.component';

@Component({selector:'app-turing-demo-controller',standalone:true,imports:[CommonModule,AgentInspectorComponent,EvidenceViewComponent],
  templateUrl:'./turing-demo-controller.component.html',styleUrl:'./turing-demo-controller.component.scss'})
export class TuringDemoControllerComponent {
  readonly demo=inject(TuringDemoService);
  outcomeLabel(status:string){return ({COMPLETED:'\u2713 Completed',WARNING:'\u26a0 Completed with warning',SKIPPED:'\u25cb Skipped',FAILED:'\u2715 Failed'} as Record<string,string>)[status]??'\u25cb Not run';}
  time(){const seconds=this.demo.elapsed();return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
}
