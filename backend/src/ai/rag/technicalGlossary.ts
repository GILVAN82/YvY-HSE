/** Bounded retrieval vocabulary, never an evidence source or a general translator. */
export const TECHNICAL_GLOSSARY_VERSION = 'hse-pt-en-v1';
export const foldTechnical = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
type Term = { id: string; pt: string; en: string; anchor?: boolean };
export const TECHNICAL_TERMS: readonly Term[] = [
  { id: 'loto', pt: 'bloqueio e etiquetagem', en: 'LOTO lockout tagout', anchor: true },
  { id: 'ptw', pt: 'permissao de trabalho', en: 'PTW permit to work', anchor: true },
  { id: 'risk', pt: 'avaliacao de riscos?', en: 'risk assessment', anchor: true },
  { id: 'emergency', pt: 'procedimentos? de emergencia', en: 'emergency procedures', anchor: true },
  { id: 'stored-energy', pt: 'energia residual', en: 'stored residual energy', anchor: true },
  { id: 'isolation-verification', pt: 'verificar (?:o )?isolamento', en: 'verification isolation', anchor: true },
  { id: 'near-miss', pt: 'quase acidentes?', en: 'near misses' },
  { id: 'assistance', pt: 'assistencia adicional', en: 'additional assistance' },
  { id: 'alone', pt: 'por si so', en: 'by itself' },
  { id: 'maintenance', pt: 'manutencao', en: 'maintenance' },
  { id: 'control', pt: 'controlar', en: 'control' },
  { id: 'review', pt: 'revisar', en: 'review' },
  { id: 'changes', pt: 'mudancas', en: 'changes' },
  { id: 'work', pt: 'trabalho', en: 'work' },
  { id: 'task', pt: 'tarefa', en: 'task' },
  { id: 'safe', pt: 'segura', en: 'safe' },
  { id: 'planning', pt: 'planejar', en: 'planning' },
  { id: 'evacuation', pt: 'evacuacao', en: 'evacuation', anchor: true },
  { id: 'alarms', pt: 'alarmes', en: 'alarms', anchor: true },
  { id: 'support', pt: 'apoio', en: 'support' },
  { id: 'workers', pt: 'trabalhadores', en: 'workers' },
  { id: 'need', pt: 'precisam', en: 'need' },
  { id: 'requirements', pt: 'exige', en: 'requirements' },
  { id: 'guidance', pt: 'orientacao', en: 'guidance' },
  { id: 'purpose', pt: 'objetivo', en: 'purpose' },
];
const GRAMMAR = new Set('o a os as um uma de do da dos das e ou em no na nos nas para por que qual como quando devemos apos antes sobre diz torna si so explique explicar nao nunca sem exige'.split(' '));
export function technicalProjection(query: string) {
  let remaining = foldTechnical(query);
  const matches: Array<{ id: string; original: string; english: string }> = [];
  let anchored = false;
  for (const term of TECHNICAL_TERMS) {
    remaining = remaining.replace(new RegExp(`\\b${term.pt}\\b`, 'g'), original => {
      matches.push({ id: term.id, original, english: term.en }); anchored ||= !!term.anchor; return ' ';
    });
  }
  // Keep original standard numbers/acronyms; unknown content is not silently translated away.
  const exact = query.match(/\b(?:[A-Z]{2,}[A-Z0-9.-]*|\d+(?:[.-]\d+)+)\b/g) ?? [];
  for (const token of exact) remaining = remaining.split(token.toLowerCase()).join(' ');
  const unknownTerms = [...new Set((remaining.match(/[\p{L}\p{N}]+/gu) ?? []).filter(t => !GRAMMAR.has(t)))];
  const applied = anchored && matches.length > 0 && unknownTerms.length === 0;
  return { applied, matches, unknownTerms, canonicalRetrievalQuery: applied ? [...new Set([...exact, ...matches.map(m => m.english)])].join(' ') : query };
}
