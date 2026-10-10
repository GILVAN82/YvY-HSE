import type { ConversationLanguage } from './voice.types';

const explicit: Array<[RegExp, ConversationLanguage]> = [
  [/\b(?:em|para) ingl[eê]s\b|\bin english\b|\ben ingl[eé]s\b/i,'en'],
  [/\b(?:em|para) portugu[eê]s\b|\bin portuguese\b|\ben portugu[eé]s\b/i,'pt'],
  [/\b(?:em|para) espanhol\b|\bin spanish\b|\ben espa[nñ]ol\b/i,'es'],
  [/\b(?:em|para) franc[eê]s\b|\bin french\b|\ben fran[cç]ais\b/i,'fr'],
  [/\b(?:em|para) alem[aã]o\b|\bin german\b|\ben alem[aá]n\b/i,'de'],
];
const words: Record<ConversationLanguage,RegExp>={
  pt:/\b(quais|qual|que|tem|há|alguma|ações|ação|estão|segurança|procedimento|explique|isso|atrasadas|atrasada|pendência|pendências|incidente|incidentes|aberto|abertos|precisa|atenção|riscos|projetos|quantos|mostre|devo|seguir)\b/gi,
  es:/\b(qué|cuál|hay|alguna|acciones|están|seguridad|procedimiento|pendiente|incidente|abierto|atención|debo|seguir|explique)\b/gi,
  en:/\b(what|which|any|actions|are|safety|procedure|pending|incident|open|attention|should|follow|explain|overdue)\b/gi,
  fr:/\b(quel|quelle|quels|quelles|actions|sécurité|procédure|retard|incident|ouvert|attention|expliquez)\b/gi,
  de:/\b(welche|was|maßnahmen|überfällig|sicherheit|verfahren|vorfall|offen|aufmerksamkeit|erklären)\b/gi,
};
export function detectConversationLanguage(text:string, browserLanguage='en'):ConversationLanguage{
  const scores=Object.entries(words).map(([language,pattern])=>[language,(text.match(pattern)?.length??0)] as const).sort((a,b)=>b[1]-a[1]);
  if(scores[0][1]>0)return scores[0][0] as ConversationLanguage;
  const browser=browserLanguage.toLowerCase().split(/[-_]/)[0] as ConversationLanguage;
  return ['en','pt','es','fr','de'].includes(browser)?browser:'en';
}
export function requestedResponseLanguage(text:string):ConversationLanguage|undefined{return explicit.find(([pattern])=>pattern.test(text))?.[1];}
export function languageName(language:ConversationLanguage){return ({en:'English',pt:'Português',es:'Español',fr:'Français',de:'Deutsch'})[language];}
