import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LOCALE_MAP } from '../../core/i18n.service';
import { operationalLanguage } from '../operational-overview/operational-copy';
import { evidenceCopy, operationalCopy, type EvidenceCopyKey } from './evidence-copy';
import type { EvidenceAction, EvidenceViewModel } from './evidence.presenter';

@Component({selector:'app-evidence-view',standalone:true,imports:[CommonModule,RouterLink],
  template:`<section class="evidence" *ngIf="model as view" [attr.aria-label]="view.title">
    <header><h3>{{view.title}}</h3><span class="verification" [class.verified]="view.verificationState==='VERIFIED'">{{view.verificationState==='VERIFIED'?'✓ ':''}}{{view.verificationLabel}}</span></header>
    <h4>{{t('conclusion')}}</h4><p class="conclusion">{{view.conclusion}}</p>
    <ng-container *ngIf="view.kind!=='knowledge'">
    <h4>{{t('explanation')}}</h4><p>{{view.explanation}}</p>
    <dl class="source-context"><dt>{{sourceLabel}}</dt><dd>{{view.sourceLabel}}</dd>
      <ng-container *ngIf="view.scopeLabel"><dt>{{t('scope')}}</dt><dd>{{view.scopeLabel}}</dd></ng-container>
      <ng-container *ngIf="view.jurisdiction"><dt>{{t('jurisdiction')}}</dt><dd>{{view.jurisdiction}}</dd></ng-container>
      <ng-container *ngIf="view.checkedAt"><dt>{{t('checked')}}</dt><dd><time [attr.datetime]="view.checkedAt">{{checkedTime(view.checkedAt)}}</time></dd></ng-container>
    </dl><p class="notice" *ngIf="view.checkedAt">{{t('historical')}}</p>
    <h4 *ngIf="view.evidenceItems.length">{{t('items')}}</h4>
    <ul class="evidence-items"><li *ngFor="let item of view.evidenceItems"><strong>{{item.label}}</strong><p *ngIf="item.value">{{item.value}}</p>
      <blockquote *ngIf="item.passage">{{item.passage}}</blockquote>
      <p *ngIf="item.source">{{sourceLabel}}: {{item.source}}</p><p *ngIf="item.jurisdiction">{{t('jurisdiction')}}: {{item.jurisdiction}}</p><p *ngIf="item.version">{{t('version')}}: {{item.version}}</p>
      <ng-container *ngTemplateOutlet="action;context:{$implicit:item.action}"></ng-container>
    </li></ul>
    </ng-container>
    <ul class="evidence-items" *ngIf="view.kind==='knowledge'"><li *ngFor="let item of view.evidenceItems">
      <h4>{{t('approvedSource')}}</h4><strong>{{item.label}}</strong>
      <h4>{{t('relevantGuidance')}}</h4><blockquote>{{item.passage}}</blockquote>
      <dl class="source-context" *ngIf="item.jurisdiction || item.version">
        <ng-container *ngIf="item.jurisdiction"><dt>{{t('jurisdiction')}}</dt><dd>{{item.jurisdiction}}</dd></ng-container>
        <ng-container *ngIf="item.version"><dt>{{t('version')}}</dt><dd>{{item.version}}</dd></ng-container>
      </dl>
      <ng-container *ngTemplateOutlet="action;context:{$implicit:item.action}"></ng-container>
    </li></ul>
    <ng-container *ngIf="view.missing.length"><h4>{{t('available')}}</h4><ul *ngIf="view.available.length; else none"><li *ngFor="let item of view.available">{{item}}</li></ul><ng-template #none><p>{{t('noEvidence')}}</p></ng-template>
      <h4>{{t('missing')}}</h4><ul><li *ngFor="let item of view.missing">{{item}}</li></ul></ng-container>
    <ng-container *ngIf="view.nextStep"><h4>{{t('next')}}</h4><p>{{view.nextStep}}</p></ng-container>
    <footer><ng-container *ngTemplateOutlet="action;context:{$implicit:view.sourceAction}"></ng-container><ng-container *ngTemplateOutlet="action;context:{$implicit:view.nextAction}"></ng-container></footer>
  </section>
  <ng-template #action let-item><ng-container *ngIf="item">
    <a *ngIf="item.route" [routerLink]="item.route">{{item.label}}</a>
    <a *ngIf="item.url" [href]="item.url" target="_blank" rel="noopener noreferrer">{{item.label}}</a>
    <button *ngIf="item.approvalTarget" type="button" (click)="showApproval(item)">{{item.label}}</button>
  </ng-container></ng-template>`,
  styles:[`:host{display:block;min-width:0}.evidence{margin-top:12px;padding:16px;border:1px solid #2a5368;border-radius:12px;background:#091c2a;color:#cadce7;font-size:13px;line-height:1.6;overflow-wrap:anywhere}header{display:flex;align-items:start;gap:12px;flex-wrap:wrap}h3{font-size:14px;margin:0;flex:1}h4{font-size:12px;color:#80d8e2;margin:16px 0 5px}p{font-size:13px;line-height:1.6;margin:4px 0}.verification{font-size:12px;color:#ffcc80}.verification.verified{color:#67d7b2}.conclusion{font-weight:600;color:#e1eff5}.source-context{display:grid;grid-template-columns:minmax(80px,auto) minmax(0,1fr);gap:4px 12px;margin:16px 0 6px}dt{color:#8db3c6}dd{margin:0}.notice{color:#8db3c6;font-size:12px}ul{padding-left:20px;margin:6px 0}.evidence-items{list-style:none;padding:0;display:grid;gap:10px}.evidence-items>li{padding:10px 12px;border-left:2px solid #31798d;background:#102533}blockquote{margin:8px 0;white-space:pre-wrap}footer{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}a,button{display:inline-flex;margin-top:6px;padding:6px 10px;border:1px solid #356073;border-radius:7px;background:#123144;color:#8de5ef;font:inherit;font-size:12px;text-decoration:none;cursor:pointer}a:focus-visible,button:focus-visible{outline:2px solid #60dae5;outline-offset:3px}`],
})
export class EvidenceViewComponent {
  @Input() model?:EvidenceViewModel;
  @Input() language='en';
  t(key:EvidenceCopyKey){return evidenceCopy(key,this.language);}
  get sourceLabel(){return operationalCopy('source',this.language);}
  checkedTime(value:string){return new Intl.DateTimeFormat(LOCALE_MAP[operationalLanguage(this.language)],{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
  showApproval(action:EvidenceAction){if('approvalTarget' in action){const target=document.getElementById(action.approvalTarget);target?.scrollIntoView({block:'center',behavior:'smooth'});target?.focus({preventScroll:true});}}
}
