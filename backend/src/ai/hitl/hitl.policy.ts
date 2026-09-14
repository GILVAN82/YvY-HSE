export type AgentActionClass = 'INFORMATION_ONLY' | 'ANALYSIS' | 'RECOMMENDATION' | 'CRITICAL_APPROVAL';

type ContextTurn = {role:'user'|'assistant';content:string};
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const isolationContext=/\b(loto|lock(?:ing|ed)?[ -]?out|tag[ -]?out|energy isolation|hazardous energy|bloqueio|etiquetagem|isolamento|isolation|isolat(?:e|ed|ing)|isolad[oa]|isolar)\b/;
export function hasLotoContext(message:string):boolean {return isolationContext.test(fold(message));}
/** Whole-utterance follow-ups only; no fuzzy topic/identifier inheritance. */
export function isLotoExecutionFollowUp(message:string):boolean {
  const text=fold(message).replace(/[?.!]/g,'').trim();
  return /^(?:(?:can|may|could) (?:i|we) (?:proceed|continue|resume work|restart (?:it|the machine)|re[ -]?energi[sz]e it)(?: now)?|is (?:this|the) equipment (?:cleared|safe) to (?:restart|operate)(?: now)?|(?:posso|podemos) (?:prosseguir|continuar|retomar o trabalho|reiniciar a maquina|reenergizar o equipamento)(?: agora)?|o equipamento pode ser religado(?: agora)?)$/.test(text);
}

export function humanApprovalRequiredMessage(language='en'):string {
  const messages={
    en:'This request requires human approval. YvY cannot confirm physical isolation or authorize the work.',
    pt:'Esta solicitação exige aprovação humana. A YvY não pode confirmar o isolamento físico nem autorizar o trabalho.',
    es:'Esta solicitud requiere aprobación humana. YvY no puede confirmar el aislamiento físico ni autorizar el trabajo.',
    fr:'Cette demande nécessite une approbation humaine. YvY ne peut pas confirmer l’isolation physique ni autoriser le travail.',
    de:'Diese Anfrage erfordert eine menschliche Genehmigung. YvY kann die physische Isolierung nicht bestätigen oder die Arbeit freigeben.',
  };
  return messages[language as keyof typeof messages]??messages.en;
}

export function classifyAgentAction(message: string, history:readonly ContextTurn[]=[]): AgentActionClass {
  const text=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const antecedent=[...history].reverse().find(turn=>turn.role==='user');
  const contextual=isLotoExecutionFollowUp(text);
  const isolation=hasLotoContext(text) || contextual && Boolean(antecedent && hasLotoContext(antecedent.content));
  const authority=/\b(approve|authorize|authorise|declare|sign[ -]?off|aprovar|aprove|aprova|autorizar|autorize|autoriza|liberar|libere|libera)\b/.test(text);
  const execution=/\b(proceed|start|begin|continue|operate|restart|resume|energize|energise|re[ -]?energi[sz]e|execute|execution|release|prosseguir|iniciar|comecar|continuar|operar|reiniciar|retomar|religar|religado|energizar|reenergizar|executar|execucao)\b/.test(text);
  const permission=/\b(can|may|could|let|allow|permit|permission|clearance|cleared|ready|safe|posso|podemos|pode|poderia|permita|permissao|seguro|segura)\b/.test(text);
  const energization=/\b(re[ -]?energi[sz]e|reenergizar|religar|religado)\b/.test(text);
  // A knowledge question about who/how to approve is not an instruction to approve.
  // An additional directive after it must still trigger the gate.
  const explanation=/^\s*(?:(?:can|could|would) you |(?:pode|poderia) (?:voce )?)?(explain|describe|what|which|how|who|why|when|explique|descreva|quais?|como|quem|por que|quando)\b/.test(text);
  const directive=/(?:[.!?;]\s*|\b(?:and|then|also|e|depois|tambem)\s+)(?:please\s+)?(?:approve|authorize|authorise|start|restart|aprovar|aprove|autorize|libere|inicie|religue|(?:can|may|could) (?:i|we)|posso|podemos)\b/.test(text);
  const imperative=/^\s*(?:please\s+)?(?:start|execute|resume|restart|energize|energise|re[ -]?energi[sz]e|release|(?:allow|permit)\s+(?:me|us|this|the|work|execution|loto)|inicie|execute|reinicie|retome|religue|energize|reenergize)\b/.test(text);
  if((isolation||energization) && (!explanation||directive) && (authority || execution && permission || imperative))return 'CRITICAL_APPROVAL';
  if (/\b(recommend|recommendation|recomenda|recomendação)\b/i.test(message)) return 'RECOMMENDATION';
  if (/\b(analy[sz]e|analysis|avaliar|análise)\b/i.test(message)) return 'ANALYSIS';
  return 'INFORMATION_ONLY';
}
