export type ResponseLanguage = 'en' | 'pt' | 'es' | 'fr' | 'de';

const SUPPORTED = new Set<ResponseLanguage>(['en', 'pt', 'es', 'fr', 'de']);

export function normalizeUiLanguage(locale?: string): ResponseLanguage | undefined {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0] as ResponseLanguage | undefined;
  return language && SUPPORTED.has(language) ? language : undefined;
}

export function detectMessageLanguage(message: string): ResponseLanguage | undefined {
  const text = ` ${message.toLowerCase()} `;
  if (/\b(qual|quais|quem|você|ações|segurança|presidente do|receita de|instruções|lembre|senha)\b/i.test(text)) return 'pt';
  if (/\b(quién|cuál|dime|muestra|instrucciones|seguridad|presidente de|recuerda|contraseña)\b/i.test(text)) return 'es';
  if (/\b(quelle|montre|révèle|sécurité|président de)\b/i.test(text)) return 'fr';
  if (/\b(welche|zeige|enthülle|sicherheit|präsident)\b/i.test(text)) return 'de';
  const scores: Record<ResponseLanguage, number> = { en: 0, pt: 0, es: 0, fr: 0, de: 0 };
  const patterns: Record<ResponseLanguage, RegExp> = {
    en: /\b(the|this|that|who|what|which|please|previous|instructions|reveal|show|answer|system|safe|with|from|your)\b/g,
    pt: /\b(quem|qual|quais|que|esta|este|por|para|com|instrucoes|anteriores|mostre|revele|responda|sistema|seguranca|voce|seu|sua)\b/g,
    es: /\b(quien|cual|que|esta|este|por|para|con|instrucciones|anteriores|muestra|revela|responde|sistema|seguridad|dime|tu)\b/g,
    fr: /\b(qui|quel|quelle|cette|avec|pour|instructions|precedentes|montre|revele|reponds|systeme|securite|votre)\b/g,
    de: /\b(wer|was|welche|dies|mit|fur|anweisungen|vorherigen|zeige|enthulle|antworte|system|sicherheit|dein)\b/g,
  };
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const language of Object.keys(patterns) as ResponseLanguage[]) scores[language] = normalized.match(patterns[language])?.length ?? 0;
  const ranked = (Object.entries(scores) as Array<[ResponseLanguage, number]>).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] >= 2 && ranked[0][1] > ranked[1][1] ? ranked[0][0] : undefined;
}

export function resolveResponseLanguage(input: { userMessage?: string; uiLanguage?: string }): ResponseLanguage {
  return detectMessageLanguage(input.userMessage ?? '') ?? normalizeUiLanguage(input.uiLanguage) ?? 'en';
}

export function localized<T extends string>(templates: Record<ResponseLanguage, T>, language: ResponseLanguage): T {
  return templates[language] ?? templates.en;
}
