/** Bounded read requests; compound execution/decision directives retain the HITL gate. */
export function isPendingApprovalQuery(message:string):boolean {
  const text=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[?!\u00bf\u00a1.,]/g,' ').replace(/\s+/g,' ').trim();
  if(/\b(and|e|then|also|approve|aprove|execute|execution|authorize|authorise|start|restart|reenergize|depois|autorize|execute|inicie)\b/.test(text))return false;
  const match=text.match(/^(?:please )?(?:show|list|display)(?: me)?(?: the| my| all)? pending approvals\b/)
    ?? text.match(/^(?:which approvals are waiting|what needs my approval|any approvals pending|quais aprovacoes estao pendentes|tenho algo para aprovar|(?:mostre|listar|liste)(?: as| minhas)? aprovacoes pendentes|(?:que|cuales) aprobaciones (?:estan )?pendientes|tengo algo (?:para|que) aprobar|(?:quelles|les) approbations (?:sont )?en attente|(?:afficher|montrez)(?: les)? approbations en attente|welche genehmigungen (?:sind )?ausstehend|(?:zeige|liste)(?: die)? ausstehenden genehmigungen)\b/);
  if(!match)return false;
  const suffix=text.slice(match[0].length).trim();
  return !suffix || /^(?:for(?: project)?|in project|no projeto|do projeto|para o projeto) [\w-]+$/.test(suffix);
}
