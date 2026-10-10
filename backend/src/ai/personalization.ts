import type { ResponseLanguage } from './responseLanguage';

export function safeFirstName(displayName: string | null | undefined): string | undefined {
  const first = displayName?.trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{M}'-]/gu, '').slice(0, 40);
  return first || undefined;
}

export function contextualGreeting(language: ResponseLanguage, firstName: string | undefined, hour = new Date().getHours()): string | undefined {
  if (!firstName) return undefined;
  const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const greetings = {
    en:{morning:'Good morning',afternoon:'Good afternoon',evening:'Good evening'},
    pt:{morning:'Bom dia',afternoon:'Boa tarde',evening:'Boa noite'},
    es:{morning:'Buenos días',afternoon:'Buenas tardes',evening:'Buenas noches'},
    fr:{morning:'Bonjour',afternoon:'Bonjour',evening:'Bonsoir'},
    de:{morning:'Guten Morgen',afternoon:'Guten Tag',evening:'Guten Abend'},
  } as const;
  return `${greetings[language][period]}, ${firstName}.`;
}
