import { foldTechnical, technicalProjection } from '../rag/technicalGlossary';
import { hasLotoContext } from '../hitl/hitl.policy';

/** Interpret methodological questions before incidental words such as record/PPE/incident.
 * Explicit writes/counts/live records retain their existing operational route. */
export function isHseKnowledgeQuestion(input: string): boolean {
  const text = foldTechnical(input);
  const question = /^(?:(?:can|could|would) you )?(explain|describe|what|who|why|when|how|does|should|como|quem|quando|quais?|o que|explique|uma)\b/.test(text.trim());
  if (!question) return false;
  if (/\b(how many|count|list|show|quantos|liste|mostre|current|currently|today|overdue|status|atual|hoje)\b/.test(text)) return false;
  if (/(?:^|\b(?:and|then|e|depois)\s+)(?:please\s+)?(?:create|add|register|record|log|crie|registre|cadastre|adicione)\s+(?:(?:a|an|the|new|um|uma|novo|nova)\s+)*(?:incident|action|record|observation|incidente|acao|registro|observacao)\b/.test(text)) return false;
  return hasLotoContext(input) || /\b(?:osha\s+)?1910\.147\b/.test(text) || /\b(loto|lockout|tagout|ptw|permit.to.work|risk assessment|hazard identification|emergency|hazardous energy|hazards?|substitution|ppe)\b/.test(text) || technicalProjection(input).applied;
}
