import type { RetrievalCase } from './retrieval.evaluation';
const L = 'yvy-kb-loto-osha-1910-147', P = 'yvy-kb-ptw-hse-hsg250';
const R = 'yvy-kb-risk-assessment-hse', E = 'yvy-kb-emergency-procedures-hse';
const all = [L, P, R, E];
type ApprovedCase = RetrievalCase & { language: 'en' | 'pt'; rationale: string };
const item = (id: string, query: string, language: 'en' | 'pt', requiredSources: string[], rationale: string): ApprovedCase =>
  ({ id, query, language, requiredSources, relevantSources: requiredSources,
    irrelevantSources: all.filter(s => !requiredSources.includes(s)), rationale });

/** Manual source-section labels frozen before any retrieval results were inspected.
 * These judge which summaries directly answer the question, not generic topical overlap. */
export const APPROVED_CORPUS_CASES: ApprovedCase[] = [
  item('loto-code', 'What does OSHA 1910.147 say about hazardous energy control?', 'en', [L], 'LOTO: Purpose and scope, exact standard identifier.'),
  item('loto-sequence', 'Explain preparation, shutdown, stored energy control and verification of isolation in LOTO.', 'en', [L], 'LOTO: Core control sequence.'),
  item('loto-pt', 'Como controlar a energia residual e verificar o isolamento antes da manutenção?', 'pt', [L], 'LOTO: Core control sequence; Portuguese paraphrase.'),
  item('ptw-code', 'Explain PTW under HSE HSG250.', 'en', [P], 'PTW: Purpose and handling notes, publication identifier.'),
  item('ptw-lifecycle', 'Describe permit-to-work issue, acceptance, suspension, handover, hand-back and closure.', 'en', [P], 'PTW: Essential features.'),
  item('ptw-pt', 'Uma permissão de trabalho torna a tarefa segura por si só?', 'pt', [P], 'PTW: Purpose explicitly rejects permit alone as safety guarantee.'),
  item('risk-cycle', 'Explain the risk assessment cycle: identify hazards, assess risks, control, record and review.', 'en', [R], 'Risk Assessment: Risk-management cycle.'),
  item('risk-controls', 'Why consider eliminating a hazard before substitution, reduced exposure and PPE?', 'en', [R], 'Risk Assessment: Assess and control.'),
  item('risk-pt', 'Quando devemos revisar a avaliação de riscos após mudanças no trabalho ou quase acidentes?', 'pt', [R], 'Risk Assessment: Record and review.'),
  item('emergency-planning', 'What should emergency arrangements cover for alarms, escape, assembly and emergency lighting?', 'en', [E], 'Emergency: Elements of an emergency arrangement.'),
  item('emergency-recovery', 'Should normal work resume while serious danger remains after an emergency?', 'en', [E], 'Emergency: Recovery.'),
  item('emergency-pt', 'Como planejar evacuação, alarmes e apoio a trabalhadores que precisam de assistência adicional?', 'pt', [E], 'Emergency: Elements and training needs.'),
  item('no-evidence', 'Explain telescope calibration for detecting distant galaxies.', 'en', [], 'None of the four summaries discusses astronomy.'),
  { ...item('jurisdiction-trap', 'Does OSHA 1910.147 establish the law for LOTO in Portugal?', 'en', [], 'US summary explicitly cannot establish Portuguese law.'), jurisdiction: 'Portugal' },
  item('distinguish-controls', 'Distinguish hazardous energy isolation in LOTO from work authorization in PTW.', 'en', [L, P], 'LOTO core sequence versus PTW purpose and authorization.'),
  item('integrated-risk-permit', 'How do hazard identification and risk assessment connect to permit-to-work precautions and authorization?', 'en', [R, P], 'Risk methodology plus PTW interface; both sources required.'),
];
