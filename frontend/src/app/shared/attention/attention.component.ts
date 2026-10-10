import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EvidenceViewComponent } from '../evidence-view/evidence-view.component';
import { attentionText, presentAttention, attentionEvidence, type AttentionFacts } from './attention.presenter';
import { presentResponseEvidence, type EvidenceSnapshot } from '../evidence-view/evidence.presenter';
import { evidenceCopy } from '../evidence-view/evidence-copy';
@Component({selector:'app-attention-summary',standalone:true,imports:[CommonModule],template:`
<button type="button" *ngIf="count>0" [attr.data-priority]="priority" (click)="review.emit()">
  <span class="heading"><svg class="attention-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5m0 3v1"/></svg>{{copy.heading}}<span class="count-badge" aria-hidden="true">{{count}}</span></span>
  <strong>{{count}} {{count===1?copy.one:copy.many}}</strong>
  <small *ngIf="critical || high"><span class="severity critical" *ngIf="critical">{{critical}} {{copy.critical}}</span><span aria-hidden="true" *ngIf="critical && high"> · </span><span class="severity high" *ngIf="high">{{high}} {{copy.high}}</span></small>
  <span class="cta">{{copy.review}} <span aria-hidden="true">→</span></span>
</button>`,styleUrl:'./attention-summary.scss'})
export class AttentionSummaryComponent {
 @Input() count=0;@Input() critical=0;@Input() high=0;@Input() language='en';@Output() review=new EventEmitter<void>();
 get copy(){return attentionText(this.language);}get priority(){return this.count<=0?'neutral':this.critical>0?'critical':this.high>0?'high':'notice';}
}
@Component({selector:'app-attention-item',standalone:true,imports:[CommonModule,EvidenceViewComponent],template:`<article *ngIf="facts"><header><strong>{{view.title}}</strong><span>{{view.severity}}</span></header><p>{{view.businessStatus}}</p><dl><ng-container *ngIf="view.projectLabel"><dt>{{copy.project}}</dt><dd>{{view.projectLabel}}</dd></ng-container><dt>{{copy.why}}</dt><dd>{{view.summary}}</dd><ng-container *ngIf="facts.sourceType==='HITL'"><dt>{{copy.cannot}}</dt><dd>{{copy.physical}}</dd></ng-container></dl><button *ngIf="!explained" type="button" (click)="explain.emit()">{{copy.ask}}</button><button *ngIf="explained && approvalTarget" type="button" (click)="reviewApproval()">{{view.primaryAction}}</button><button *ngIf="explained" type="button" (click)="evidenceOpen=!evidenceOpen" [attr.aria-expanded]="evidenceOpen">{{view.evidenceAction}}</button><app-evidence-view *ngIf="evidenceOpen" [model]="evidence" [language]="language"></app-evidence-view><ng-container *ngIf="evidenceOpen"><app-evidence-view *ngFor="let source of sources" [model]="source" [language]="language"></app-evidence-view></ng-container></article>`,styles:[`:host{display:block;min-width:0}article{padding:16px;margin:10px 0;border:1px solid #28536a;border-radius:12px;background:#0c2232;color:#cbdde8;font-size:13px;line-height:1.6}header{display:flex;justify-content:space-between;gap:12px}strong{font-size:14px}dl{display:grid;gap:6px}dt{color:#8fc4d4}dd{margin:0}button{font:inherit;color:#7ce0eb;background:#123144;border:1px solid #356073;border-radius:7px;padding:6px 10px;margin:6px 8px 0 0;cursor:pointer}`]})
export class AttentionItemComponent {
 @Input() snapshot?:EvidenceSnapshot;@Input({required:true}) facts!:AttentionFacts;@Input() language='en';@Input() explained=false;@Input() knowledgeAvailable=false;@Input() approvalTarget?:string;@Output() explain=new EventEmitter<void>();@Output() review=new EventEmitter<void>();evidenceOpen=false;
 get copy(){return attentionText(this.language);}get view(){return presentAttention(this.facts,this.language);}get evidence(){return attentionEvidence(this.facts,this.language,this.knowledgeAvailable);}
 get sources(){return this.snapshot?presentResponseEvidence(this.snapshot,evidenceCopy('ragExplanation',this.language),this.language).filter(item=>item.kind==='knowledge'):[];}
 reviewApproval(){this.review.emit();if(this.approvalTarget){const target=document.getElementById(this.approvalTarget);target?.scrollIntoView({block:'center',behavior:'smooth'});target?.focus({preventScroll:true});}}
}
