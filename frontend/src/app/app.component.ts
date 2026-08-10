import { Component, HostListener, OnInit, ViewChild, computed, signal } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, BookOpenText, Check, ChevronDown, Menu, Moon, Sun } from 'lucide-angular';
import { filter } from 'rxjs';
import { I18nService, Lang } from './core/i18n.service';
import { NAVIGATION } from './core/navigation.config';
import { AiChatWidgetComponent } from './shared/ai-chat-widget/ai-chat-widget.component';
import { SidebarComponent } from './shared/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule, FormsModule, LucideAngularModule, AiChatWidgetComponent, SidebarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  @ViewChild(SidebarComponent) sidebar?: SidebarComponent;

  readonly menuIcon = Menu;
  readonly sunIcon = Sun;
  readonly moonIcon = Moon;
  readonly chevronIcon = ChevronDown;
  readonly checkIcon = Check;
  readonly instructionsIcon = BookOpenText;

  /**
   * Display identity for the topbar. The app has no authentication, so this is a
   * label, not a session: set `userAvatar` to an image path to replace the initials.
   */
  readonly userName = 'HSE Manager';
  readonly userAvatar: string | null = null;
  readonly userInitials = this.userName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  userMenuOpen = signal(false);

  langs: { value: Lang; label: string; short: string; name: string }[] = [
    { value: 'en', label: 'EN — English', short: 'EN', name: 'English' },
    { value: 'pt', label: 'PT — Português', short: 'PT', name: 'Português' },
    { value: 'es', label: 'ES — Español', short: 'ES', name: 'Español' },
    { value: 'fr', label: 'FR — Français', short: 'FR', name: 'Français' },
    { value: 'de', label: 'DE — Deutsch', short: 'DE', name: 'Deutsch' },
  ];

  langMenuOpen = signal(false);
  currentLang = computed(() => this.langs.find((l) => l.value === this.i18n.lang()) ?? this.langs[0]);

  toggleLangMenu() {
    this.langMenuOpen.update((v) => !v);
    if (this.langMenuOpen()) this.userMenuOpen.set(false); // one menu at a time
  }

  async pickLang(l: Lang) {
    this.langMenuOpen.set(false);
    await this.onLangChange(l);
    document.getElementById('langbtn')?.focus();
  }

  /** Narrow screens show just the language code — truncating the full label is worse. */
  compact = signal(window.innerWidth < 768);

  @HostListener('window:resize')
  onWindowResize() {
    this.compact.set(window.innerWidth < 768);
  }

  /** Source names of the active page and its group; translated lazily so the
      breadcrumb follows the language. */
  private crumbSheet = signal('');
  private crumbGroup = signal('');
  crumbTrail = computed(() => this.i18n.t(this.crumbGroup() || NAVIGATION[0].label));
  crumbPage = computed(() => {
    const s = this.crumbSheet();
    if (!s) return '';
    return this.i18n.lang() === 'en' ? s : this.i18n.t(s);
  });
  crumbTitle = computed(() => this.crumbPage() || this.crumbTrail());

  private static readonly THEME_KEY = 'hse-theme';
  theme = signal<'light' | 'dark'>(this.getInitialTheme());

  constructor(public i18n: I18nService, private router: Router) {}

  async ngOnInit() {
    await this.i18n.init();
    this.applyTheme(this.theme());
    this.syncToUrl(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.syncToUrl((e as NavigationEnd).urlAfterRedirects);
    });
  }

  async onLangChange(l: Lang) {
    await this.i18n.setLang(l);
  }

  openMobileNav(ev: Event) {
    this.sidebar?.openDrawer(ev.currentTarget as HTMLElement);
  }

  toggleUserMenu() {
    this.userMenuOpen.update((v) => !v);
    if (this.userMenuOpen()) this.langMenuOpen.set(false); // one menu at a time
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent) {
    const t = ev.target as HTMLElement;
    if (this.userMenuOpen() && !t.closest('.userblock')) this.userMenuOpen.set(false);
    if (this.langMenuOpen() && !t.closest('.langpick')) this.langMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.userMenuOpen()) this.userMenuOpen.set(false);
    if (this.langMenuOpen()) {
      this.langMenuOpen.set(false);
      document.getElementById('langbtn')?.focus();
    }
  }

  private syncToUrl(url: string) {
    const path = decodeURIComponent(url.split('?')[0]);
    for (const m of NAVIGATION) {
      const item = m.items.find((i) => i.route === path);
      if (!item) continue;
      this.crumbSheet.set(item.label);
      this.crumbGroup.set(m.label);
      return;
    }
    this.crumbSheet.set('');
    this.crumbGroup.set('');
  }

  toggleTheme() {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
    try {
      localStorage.setItem(AppComponent.THEME_KEY, next);
    } catch {
      // localStorage is unavailable (private mode, etc.); the preference does not persist in this session.
    }
  }

  private getInitialTheme(): 'light' | 'dark' {
    try {
      const saved = localStorage.getItem(AppComponent.THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(t: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', t);
  }
}
