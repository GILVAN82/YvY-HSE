export type AgentActionClass = 'INFORMATION_ONLY' | 'ANALYSIS' | 'RECOMMENDATION' | 'CRITICAL_APPROVAL';

export function classifyAgentAction(message: string): AgentActionClass {
  const text=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isolation=/\b(loto|lock[ -]?out|tag[ -]?out|bloqueio|etiquetagem|isolamento|isolation|isolat(?:e|ed|ing)|isolad[oa]|isolar)\b/.test(text);
  const authority=/\b(approve|authorize|authorise|declare|sign[ -]?off|aprovar|aprove|aprova|autorizar|autorize|autoriza|liberar|libere|libera)\b/.test(text);
  const execution=/\b(proceed|start|begin|continue|operate|restart|resume|energize|energise|reenergize|re-energize|execute|prosseguir|posso prosseguir|iniciar|comecar|continuar|operar|reiniciar|retomar|religar|energizar|reenergizar|executar)\b/.test(text);
  const permission=/\b(can|may|could|let|allow|permission|clearance|ready|safe|posso|podemos|poderia|permita|permissao|seguro|segura)\b/.test(text);
  // A knowledge question about who/how to approve is not an instruction to approve.
  // An additional directive after it must still trigger the gate.
  const explanation=/^\s*(?:(?:can|could|would) you |(?:pode|poderia) (?:voce )?)?(explain|describe|what|which|how|who|why|when|explique|descreva|quais?|como|quem|por que|quando)\b/.test(text);
  const directive=/(?:[.!?;]\s*|\b(?:and|then|also|e|depois|tambem)\s+)(?:please\s+)?(?:approve|authorize|authorise|start|restart|aprovar|aprove|autorize|libere|inicie|religue|(?:can|may|could) (?:i|we)|posso|podemos)\b/.test(text);
  if(isolation && (!explanation||directive) && (authority || execution && permission || /^\s*(?:please\s+)?(?:start|restart|resume|energize|energise|inicie|reinicie|retome|religue|energize)\b/.test(text)))return 'CRITICAL_APPROVAL';
  if (/\b(recommend|recommendation|recomenda|recomendação)\b/i.test(message)) return 'RECOMMENDATION';
  if (/\b(analy[sz]e|analysis|avaliar|análise)\b/i.test(message)) return 'ANALYSIS';
  return 'INFORMATION_ONLY';
}
