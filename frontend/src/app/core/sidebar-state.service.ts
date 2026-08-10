import { Injectable, computed, effect, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { NAVIGATION, NavigationItem, NavigationModule } from './navigation.config';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

const PANEL_KEY = 'hse-sidebar-collapsed'; // 'true' === panel closed (kept from the previous sidebar)
const MODULE_KEY = 'hse-sidebar-module';

export const RAIL_WIDTH = 80;
export const PANEL_WIDTH_DESKTOP = 280;
export const PANEL_WIDTH_TABLET = 260;

/**
 * Owns every piece of sidebar state. The router feeds it (route -> active module),
 * never the other way round, so there is no circular dependency: switching modules
 * on the rail changes what the panel lists and does not navigate.
 */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  /** Permissions granted to the current user. The project has no auth today, so this
      stays null and every item passes. Point a real source at it later and the
      filtering below starts working with no other change. */
  private grantedPermissions = signal<Set<string> | null>(null);

  activeRoute = signal('');
  activeModuleId = signal<string>(this.loadModule());
  previousModuleId = signal<string | null>(null);
  isSecondaryPanelOpen = signal<boolean>(!this.loadPanelClosed());
  viewport = signal<Viewport>(this.readViewport());
  /** Set while the mobile drawer is open, so focus can be returned to its trigger. */
  drawerTrigger: HTMLElement | null = null;

  /** Modules the user may see, with their permitted items. Modules left without any
      accessible item are dropped entirely. */
  modules = computed<NavigationModule[]>(() =>
    NAVIGATION
      .filter((m) => this.allowed(m.permissions))
      .map((m) => ({ ...m, items: m.items.filter((i) => this.allowed(i.permissions)) }))
      .filter((m) => m.items.length > 0)
  );

  activeModule = computed<NavigationModule>(
    () => this.modules().find((m) => m.id === this.activeModuleId()) ?? this.modules()[0]
  );

  /** Width the page must reserve. The panel overlays on tablet and mobile, so only
      the rail counts there. */
  reservedWidth = computed(() => {
    const v = this.viewport();
    if (v === 'mobile') return 0;
    if (!this.isSecondaryPanelOpen()) return RAIL_WIDTH;
    if (v === 'tablet') return RAIL_WIDTH;
    return RAIL_WIDTH + PANEL_WIDTH_DESKTOP;
  });

  panelWidth = computed(() => (this.viewport() === 'tablet' ? PANEL_WIDTH_TABLET : PANEL_WIDTH_DESKTOP));

  /** True while the panel floats above the page instead of pushing it. */
  panelOverlays = computed(() => this.viewport() !== 'desktop' && this.isSecondaryPanelOpen());

  constructor(private router: Router) {
    this.syncToUrl(this.router.url);
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.syncToUrl((e as NavigationEnd).urlAfterRedirects));

    effect(() => {
      document.documentElement.style.setProperty('--sb-reserved', `${this.reservedWidth()}px`);
    });
    effect(() => {
      const locked = this.viewport() === 'mobile' && this.isSecondaryPanelOpen();
      document.body.classList.toggle('sb-locked', locked);
    });
  }

  // -------------------------------------------------------------- permissions

  private allowed(required?: string[]): boolean {
    if (!required?.length) return true;
    const granted = this.grantedPermissions();
    if (!granted) return true; // no permission source wired up yet
    return required.every((p) => granted.has(p));
  }

  /** Hook for when authentication lands — pass the user's permission keys. */
  setPermissions(permissions: string[] | null) {
    this.grantedPermissions.set(permissions ? new Set(permissions) : null);
  }

  // ------------------------------------------------------------------ modules

  /**
   * Rail click, per the agreed rules: a different module becomes active and opens
   * the panel; the active module re-opens a closed panel; an already-open panel
   * stays open. Closing happens only through the panel's close button.
   */
  selectModule(id: string) {
    if (this.activeModuleId() !== id) {
      this.previousModuleId.set(this.activeModuleId());
      this.activeModuleId.set(id);
      this.saveModule(id);
    }
    if (!this.isSecondaryPanelOpen()) this.openPanel();
  }

  openPanel() {
    this.isSecondaryPanelOpen.set(true);
    this.savePanelClosed(false);
  }

  closePanel() {
    this.isSecondaryPanelOpen.set(false);
    this.savePanelClosed(true);
    const trigger = this.drawerTrigger;
    this.drawerTrigger = null;
    trigger?.focus();
  }

  // -------------------------------------------------------------------- route

  /** Derives the active module from the URL — this is what makes deep links work. */
  private syncToUrl(url: string) {
    const path = decodeURIComponent(url.split('?')[0]);
    this.activeRoute.set(path);
    const owner = this.modules().find((m) => m.items.some((i) => i.route === path));
    if (owner && owner.id !== this.activeModuleId()) {
      this.previousModuleId.set(this.activeModuleId());
      this.activeModuleId.set(owner.id);
      this.saveModule(owner.id);
    }
    if (this.viewport() === 'mobile' && this.isSecondaryPanelOpen()) this.closePanel();
  }

  isItemActive(item: NavigationItem): boolean {
    return item.route === this.activeRoute();
  }

  isModuleActive(m: NavigationModule): boolean {
    return m.id === this.activeModuleId();
  }

  // --------------------------------------------------------------- responsive

  refreshViewport() {
    const next = this.readViewport();
    if (next === this.viewport()) return;
    const previous = this.viewport();
    this.viewport.set(next);
    // Coming from mobile the drawer must not stay latched open over the page.
    if (previous === 'mobile' && next !== 'mobile') {
      this.isSecondaryPanelOpen.set(!this.loadPanelClosed());
    }
    if (next === 'mobile') this.isSecondaryPanelOpen.set(false);
  }

  private readViewport(): Viewport {
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1280) return 'tablet';
    return 'desktop';
  }

  // -------------------------------------------------------------- persistence

  private loadPanelClosed(): boolean {
    if (window.innerWidth < 768) return true;
    try {
      return localStorage.getItem(PANEL_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private savePanelClosed(closed: boolean) {
    if (this.viewport() === 'mobile') return; // the drawer is transient, not a preference
    try {
      localStorage.setItem(PANEL_KEY, String(closed));
    } catch {
      // localStorage is unavailable (private mode, etc.); the preference does not persist in this session.
    }
  }

  private loadModule(): string {
    try {
      const saved = localStorage.getItem(MODULE_KEY);
      if (saved && NAVIGATION.some((m) => m.id === saved)) return saved;
    } catch {
      // ignore
    }
    return NAVIGATION[0].id;
  }

  private saveModule(id: string) {
    try {
      localStorage.setItem(MODULE_KEY, id);
    } catch {
      // localStorage is unavailable (private mode, etc.); the preference does not persist in this session.
    }
  }
}
