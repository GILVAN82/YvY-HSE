import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, X } from 'lucide-angular';
import { I18nService } from '../../core/i18n.service';
import { NavigationItem, itemLink } from '../../core/navigation.config';
import { SidebarStateService } from '../../core/sidebar-state.service';

@Component({
  selector: 'app-module-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './module-panel.component.html',
  styleUrl: './module-panel.component.scss',
})
export class ModulePanelComponent {
  readonly closeIcon = X;
  itemLink = itemLink;

  constructor(public state: SidebarStateService, public i18n: I18nService) {}

  label(text: string): string {
    return this.i18n.lang() === 'en' ? text : this.i18n.t(text);
  }

  /** Same target as the rail's mark — the brand never introduces a new route. */
  get brandRoute(): string {
    return this.state.modules()[0]?.defaultRoute ?? '/home';
  }

  onItemClick(item: NavigationItem, ev: MouseEvent) {
    if (item.disabled) {
      ev.preventDefault();
      return;
    }
    // Mobile closes the drawer after a selection; syncToUrl handles it on navigation.
  }
}
