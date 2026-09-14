import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { AgentInspectorSnapshot } from '../../core/agent-inspector.service';
import { operationalCopy, type OperationalCopyKey } from './operational-copy';
import { operationalResults, presentOperationalResult } from './operational-result.presenter';

/** Business surfaces share this renderer; the Inspector keeps its technical trace. */
@Component({
  selector:'app-operational-overview', standalone:true, imports:[CommonModule,RouterLink],
  template:`<div class="overview-cards" *ngIf="cards.length">
    <span class="overview-title" *ngIf="snapshot?.executionTrace?.intent?.intent==='OPERATIONAL_OVERVIEW'">{{t('overview')}}</span>
    <section class="result-card" *ngFor="let card of cards; let index=index; trackBy:cardIndex">
      <span class="source-title">{{card.title}}</span>
      <strong>{{card.primaryValue}} {{card.businessStatus}}</strong>
      <p>{{card.summary}}</p>
      <dl *ngIf="card.metrics.length>1"><ng-container *ngFor="let metric of card.metrics.slice(1)"><dt>{{metric.label}}</dt><dd>{{metric.value}}</dd></ng-container></dl>
      <div class="card-actions"><a *ngFor="let action of card.actions" [routerLink]="action.route">{{action.label}}</a>
        <button type="button" (click)="toggle(index)" [attr.aria-expanded]="expanded.has(index)">{{t(expanded.has(index)?'hideEvidence':'viewEvidence')}}</button></div>
      <section class="evidence" *ngIf="expanded.has(index)">
        <h3>{{t('supporting')}} — {{card.title}}</h3>
        <span class="evidence-state" [attr.data-state]="card.evidenceState">{{card.evidenceState==='verified'?'✓ ':''}}{{card.evidenceLabel}}</span>
        <p>{{card.evidenceSummary}}</p><p>{{t('source')}}: {{card.title}}</p>
        <a *ngFor="let action of card.actions" [routerLink]="action.route">{{t('details')}}</a>
      </section>
    </section>
  </div>`,
  styles:[`:host{display:block;min-width:0}.overview-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:10px;margin-top:12px}.overview-title{grid-column:1/-1;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#77dce7}.result-card{min-width:0;padding:14px 16px;border:1px solid #24546e;border-radius:12px;background:#0b2232;color:#dcebf2;display:flex;flex-direction:column;gap:8px}.source-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#54d5e6}.result-card>strong{font-size:14px}.result-card p{font-size:13px;line-height:1.55;margin:0}.card-actions{display:flex;gap:8px;flex-wrap:wrap}a,button{display:inline-flex;align-items:center;padding:6px 9px;border:1px solid #2c6078;border-radius:7px;background:#102b3d;color:#7de4ee;font:inherit;font-size:12px;text-decoration:none;cursor:pointer}a:focus-visible,button:focus-visible{outline:2px solid #56dcec;outline-offset:3px}.evidence{margin-top:8px;padding-top:12px;border-top:1px solid #24546e;display:grid;gap:8px}.evidence h3{font-size:13px;margin:0}.evidence-state{font-size:12px;color:#ffcd82}.evidence-state[data-state=verified]{color:#56d6ad}dl{display:grid;grid-template-columns:1fr auto;font-size:13px;gap:4px;margin:0}dd{margin:0}`],
})
export class OperationalOverviewComponent {
  @Input() snapshot?: AgentInspectorSnapshot;
  @Input() language='en';
  expanded=new Set<number>();
  cardIndex(index:number){return index;}
  get cards(){return operationalResults(this.snapshot).map(result=>presentOperationalResult(result,this.snapshot?.executionTrace?.verification?.status,this.language));}
  t(key:OperationalCopyKey){return operationalCopy(key,this.language);}
  toggle(index:number){if(this.expanded.has(index))this.expanded.delete(index);else this.expanded.add(index);}
}
