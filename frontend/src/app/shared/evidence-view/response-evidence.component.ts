import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ApprovalSnapshot } from '../../core/agent-inspector.service';
import { EvidenceViewComponent } from './evidence-view.component';
import { presentResponseEvidence, type EvidenceSnapshot } from './evidence.presenter';
import { operationalCopy, evidenceCopy } from './evidence-copy';

@Component({selector:'app-response-evidence',standalone:true,imports:[CommonModule,EvidenceViewComponent],
  template:`<ng-container *ngIf="models.length"><button type="button" class="evidence-toggle" (click)="open=!open" [attr.aria-expanded]="open">{{label}}</button>
    <ng-container *ngIf="open"><app-evidence-view *ngFor="let model of models;trackBy:index" [model]="model" [language]="language"></app-evidence-view></ng-container></ng-container>`,
  styles:[`.evidence-toggle{margin-top:10px;padding:6px 10px;border:1px solid #356073;border-radius:7px;background:#123144;color:#8de5ef;font:inherit;font-size:12px;cursor:pointer}.evidence-toggle:focus-visible{outline:2px solid #60dae5;outline-offset:3px}`],
})
export class ResponseEvidenceComponent {
  @Input() snapshot?:EvidenceSnapshot;
  @Input() conclusion='';
  @Input() language='en';
  @Input() approval?:ApprovalSnapshot|null;
  @Input() approvalTarget?:string;
  open=false;
  get models(){return this.snapshot?presentResponseEvidence(this.snapshot,this.conclusion,this.language,this.approval??undefined,this.approvalTarget):[];}
  get label(){
    if(this.open)return operationalCopy('hideEvidence',this.language);
    if(this.snapshot?.approvalRequest)return evidenceCopy('viewDecisionBasis',this.language);
    if(this.snapshot?.executionTrace?.verification?.status==='PARTIALLY_VERIFIED')return evidenceCopy('whyConfirmation',this.language);
    if(this.snapshot?.ragUsed || this.snapshot?.evidencePresentation?.documents.length)return evidenceCopy('viewSources',this.language);
    return operationalCopy('viewEvidence',this.language);
  }
  index(index:number){return index;}
}
