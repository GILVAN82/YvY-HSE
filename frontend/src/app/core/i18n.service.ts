import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Lang = 'en' | 'pt' | 'es' | 'fr' | 'de';
export const LOCALE_MAP: Record<Lang, string> = { en: 'en-GB', pt: 'pt-BR', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' };

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<Lang>('en');
  private dict: Record<string, string> = {};
  private cache: Partial<Record<Lang, Record<string, string>>> = {};

  constructor(private http: HttpClient) {}

  async setLang(l: Lang) {
    if (!this.cache[l]) {
      this.cache[l] = await firstValueFrom(this.http.get<Record<string, string>>(`assets/i18n/${l}.json`));
    }
    this.dict = this.cache[l]!;
    this.lang.set(l);
  }

  async init() {
    await this.setLang('en');
  }

  /** Translate an English source string to the current language (fallback: original). */
  t(s: string | null | undefined): string {
    if (!s) return '';
    if (this.lang() === 'en') return s;
    return this.dict[s] ?? s;
  }

  locale(): string {
    return LOCALE_MAP[this.lang()];
  }
}
