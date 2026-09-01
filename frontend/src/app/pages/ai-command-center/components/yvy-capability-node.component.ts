import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { IconType } from '../../../core/navigation.config';

@Component({
  selector: 'app-yvy-capability-node', standalone: true, imports: [CommonModule, LucideAngularModule],
  template: `<div class="node" [class.active]="state === 'active'" [class.success]="state === 'success'" [class.warning]="state === 'warning'" [attr.aria-label]="label + ' capability, ' + state"><span><lucide-icon [img]="icon" [size]="28"></lucide-icon></span><strong>{{ label }}</strong></div>`,
  styles: [`:host{display:block}.node{display:flex;flex-direction:column;align-items:center;gap:7px;color:#d9efff;text-shadow:0 0 8px #048ed7}.node span{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;color:#c8f6ff;background:radial-gradient(circle,#113c61 0,#061d37 62%,#020c18);border:1px solid rgba(55,192,255,.75);box-shadow:inset 0 0 16px rgba(24,171,255,.28),0 0 16px rgba(0,136,255,.3);position:relative}.node span::before{content:"";position:absolute;inset:-7px;border-radius:50%;border:1px dashed rgba(51,204,255,.35)}.node strong{font-size:11px;letter-spacing:.05em;font-weight:600}.node.active span{color:#56f1ff;box-shadow:inset 0 0 22px rgba(22,204,255,.5),0 0 25px rgba(0,195,255,.68);animation:nodePulse 1.8s ease-in-out infinite}.node.success span{color:#69ffd2;border-color:#48fbc7}.node.warning span{color:#ffb26b;border-color:#ff984c}@keyframes nodePulse{50%{transform:scale(1.06)}}@media(max-width:1100px){.node span{width:52px;height:52px}.node strong{font-size:10px}}@media(prefers-reduced-motion:reduce){.node.active span{animation:none}}`]
})
export class YvyCapabilityNodeComponent {
  @Input({required:true}) label = '';
  @Input({required:true}) icon!: IconType;
  @Input() state: 'inactive'|'active'|'success'|'warning' = 'inactive';
}
