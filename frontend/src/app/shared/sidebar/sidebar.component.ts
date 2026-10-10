import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../core/sidebar-state.service';
import { ModulePanelComponent } from './module-panel.component';
import { PrimaryRailComponent } from './primary-rail.component';

/**
 * Shell for the two-level navigation: a fixed icon rail plus the module panel
 * beside it. On mobile both collapse into a single drawer over the page.
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, PrimaryRailComponent, ModulePanelComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  constructor(public state: SidebarStateService) {}

  @HostListener('window:resize')
  onResize() {
    this.state.refreshViewport();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.state.viewport() !== 'desktop' && this.state.isSecondaryPanelOpen()) {
      this.state.closePanel();
    }
  }

  /** Keeps Tab inside the drawer while it covers the page. */
  @HostListener('document:keydown.tab', ['$event'])
  onTab(ev: KeyboardEvent) {
    if (this.state.viewport() !== 'mobile' || !this.state.isSecondaryPanelOpen()) return;
    const root = document.querySelector('.sb-shell');
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement;

    if (!root.contains(active)) {
      ev.preventDefault();
      first.focus();
    } else if (ev.shiftKey && active === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  /** Called by the header's menu button on mobile. */
  openDrawer(trigger?: HTMLElement) {
    this.state.drawerTrigger = trigger ?? null;
    this.state.openPanel();
  }
}
