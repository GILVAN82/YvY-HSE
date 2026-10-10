import { APPROVED_CORPUS_CASES } from './approved-corpus.dataset';
const sources = ['yvy-kb-loto-osha-1910-147', 'yvy-kb-ptw-hse-hsg250', 'yvy-kb-risk-assessment-hse', 'yvy-kb-emergency-procedures-hse'];
const pair = (id: string, en: string, pt: string, source: string) => [
  { id: `${id}-en`, query: en, language: 'en' as const }, { id: `${id}-pt`, query: pt, language: 'pt' as const },
].map(c => ({ ...c, requiredSources: [source], relevantSources: [source], irrelevantSources: sources.filter(s => s !== source),
  rationale: 'Manually labeled EN/PT equivalent pair using the approved source purpose and scope.', pairId: id }));
/** Original sixteen cases are untouched. New labels are authored before retrieval. */
export const MULTILINGUAL_CASES = [
  ...APPROVED_CORPUS_CASES,
  ...pair('pair-loto', 'What does OSHA require for lockout/tagout?', 'O que a OSHA exige para bloqueio e etiquetagem?', sources[0]),
  ...pair('pair-risk', 'What does HSE guidance say about risk assessment?', 'O que a orientação HSE diz sobre avaliação de risco?', sources[2]),
  ...pair('pair-emergency', 'Explain emergency procedures for evacuation.', 'Explique os procedimentos de emergência para evacuação.', sources[3]),
  ...pair('pair-ptw', 'What is the purpose of permit-to-work?', 'Qual é o objetivo da permissão de trabalho?', sources[1]),
];
