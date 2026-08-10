import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { I18nService } from '../../core/i18n.service';
import { NavigationModule, UTILITY_ITEMS, UtilityItem } from '../../core/navigation.config';
import { SidebarStateService } from '../../core/sidebar-state.service';

/** Tooltip anchored beside a rail button; fixed-positioned so nothing can clip it. */
interface RailTip {
  label: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-primary-rail',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './primary-rail.component.html',
  styleUrl: './primary-rail.component.scss',
})
export class PrimaryRailComponent {
  tip = signal<RailTip | null>(null);
  utilities = UTILITY_ITEMS;

  /** Entries with no destination yet say so in their tooltip instead of failing silently. */
  utilityTip(u: UtilityItem): string {
    const label = this.i18n.t(u.label);
    return u.route ? label : `${label} · ${this.i18n.t('Soon')}`;
  }

  constructor(public state: SidebarStateService, public i18n: I18nService) {}

  select(m: NavigationModule, ev: Event) {
    this.state.drawerTrigger = ev.currentTarget as HTMLElement;
    this.state.selectModule(m.id);
    this.tip.set(null);
  }

  showTip(label: string, ev: MouseEvent | FocusEvent) {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    this.tip.set({ label: this.i18n.t(label), x: r.right + 10, y: r.top + r.height / 2 });
  }

  hideTip() {
    this.tip.set(null);
  }

  /** Home route of the first module — the logo never introduces a new route. */
  get brandRoute(): string {
    return this.state.modules()[0]?.defaultRoute ?? '/home';
  }
}
