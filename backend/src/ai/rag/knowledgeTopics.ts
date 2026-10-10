import { foldTechnical } from './technicalGlossary';
import type { RagEvidence } from './retrieval.types';
/** Primary-source constraint for the four approved modules. An incidental mention in
 * another module does not make it the primary authority for a specifically named topic. */
const topics = [
  { id: 'loto', pattern: /\b(loto|lockout|tagout|hazardous energy|stored residual energy|bloqueio|energia residual)\b/, module: /\bloto\b/ },
  { id: 'ptw', pattern: /\b(ptw|permit.to.work|permissao de trabalho)\b/, module: /permit to work/ },
  { id: 'risk', pattern: /\b(risk assessment|hazard identification|avaliacao de riscos?)\b/, module: /risk assessment/ },
  { id: 'emergency', pattern: /\b(emergency|emergencia|evacuation|evacuacao)\b/, module: /emergency/ },
];
export function supportsPrimaryTopic(originalQuery: string, evidence: RagEvidence): boolean {
  const requested = topics.filter(t => t.pattern.test(foldTechnical(originalQuery)));
  const actual = topics.find(t => t.module.test(foldTechnical(evidence.module)));
  return !requested.length || !actual || requested.some(t => t.id === actual.id);
}
