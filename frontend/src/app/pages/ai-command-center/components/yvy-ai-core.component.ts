import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShieldCheck, TriangleAlert, LucideAngularModule } from 'lucide-angular';
import type { YvyAgentVisualState } from '../yvy-visual-state';

@Component({
  selector: 'app-yvy-ai-core',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <button type="button" class="core" [attr.data-state]="state" [attr.aria-label]="'Open YvY agent overview. Current status: ' + state" (click)="open.emit()">
      <div class="orbit orbit-a"><i></i><i></i><i></i></div>
      <div class="orbit orbit-b"><i></i><i></i></div>
      <svg class="dial" viewBox="0 0 400 400" aria-hidden="true">
        <defs>
          <filter id="coreGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <linearGradient id="coreLine" x1="0" x2="1"><stop stop-color="#0aa9ff"/><stop offset=".55" stop-color="#55edff"/><stop offset="1" stop-color="#126cff"/></linearGradient>
        </defs>
        <circle class="line line-1" cx="200" cy="200" r="174"/>
        <circle class="line line-2" cx="200" cy="200" r="154"/>
        <circle class="dash dash-1" cx="200" cy="200" r="137"/>
        <circle class="dash dash-2" cx="200" cy="200" r="119"/>
        <circle class="line line-3" cx="200" cy="200" r="99"/>
        <path class="bracket" d="M65 154 A150 150 0 0 1 151 64 M249 64 A150 150 0 0 1 335 154 M335 246 A150 150 0 0 1 249 336 M151 336 A150 150 0 0 1 65 246"/>
      </svg>
      <div class="core-light"></div>
      <div class="identity">
        <lucide-icon *ngIf="state === 'verified'" [img]="shield" [size]="32"></lucide-icon>
        <lucide-icon *ngIf="state === 'error'" [img]="warning" [size]="32"></lucide-icon>
        <strong>YvY</strong>
        <span>HSE Intelligence Agent</span>
        <small>{{ stateLabel }}</small>
      </div>
    </button>
  `,
  styleUrl: './yvy-ai-core.component.scss',
})
export class YvyAiCoreComponent {
  @Input() state: YvyAgentVisualState = 'ready';
  @Output() open = new EventEmitter<void>();
  readonly shield = ShieldCheck;
  readonly warning = TriangleAlert;
  get stateLabel(): string { return this.state.replace('-', ' ').toUpperCase(); }
}
