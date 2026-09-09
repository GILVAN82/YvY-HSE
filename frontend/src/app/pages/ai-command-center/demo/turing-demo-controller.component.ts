import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TuringDemoService } from './turing-demo.service';
import { AgentInspectorComponent } from '../../agent-inspector/agent-inspector.component';

@Component({selector:'app-turing-demo-controller',standalone:true,imports:[CommonModule,AgentInspectorComponent],
  templateUrl:'./turing-demo-controller.component.html',styleUrl:'./turing-demo-controller.component.scss'})
export class TuringDemoControllerComponent {
  readonly demo=inject(TuringDemoService);
  time(){const seconds=this.demo.elapsed();return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
}
