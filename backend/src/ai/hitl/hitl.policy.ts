export type AgentActionClass = 'INFORMATION_ONLY' | 'ANALYSIS' | 'RECOMMENDATION' | 'CRITICAL_APPROVAL';

export function classifyAgentAction(message: string): AgentActionClass {
  const criticalVerb = /\b(approve|authorize|authorise|declare|sign[ -]?off|aprovar|autorizar|liberar)\b/i;
  const execution = /\b(loto|lockout[ /-]?tagout|bloqueio[ /-]?etiquetagem)\b/i;
  const safety = /\b(safe|safety|execution|execute|seguro|segura|segurança|execução|executar)\b/i;
  if (criticalVerb.test(message) && execution.test(message) && safety.test(message)) return 'CRITICAL_APPROVAL';
  if (/\b(recommend|recommendation|recomenda|recomendação)\b/i.test(message)) return 'RECOMMENDATION';
  if (/\b(analy[sz]e|analysis|avaliar|análise)\b/i.test(message)) return 'ANALYSIS';
  return 'INFORMATION_ONLY';
}
