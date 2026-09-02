import type { ConversationLanguage } from './voice.types';

const explicit: Array<[RegExp, ConversationLanguage]> = [
  [/\b(?:em|para) ingl[eê]s\b|\bin english\b|\ben ingl[eé]s\b/i,'en'],
  [/\b(?:em|para) portugu[eê]s\b|\bin portuguese\b|\ben portugu[eé]s\b/i,'pt'],
  [/\b(?:em|para) espanhol\b|\bin spanish\b|\ben espa[nñ]ol\b/i,'es'],
  [/\b(?:em|para) franc[eê]s\b|\bin french\b|\ben fran[cç]ais\b/i,'fr'],
  [/\b(?:em|para) alem[aã]o\b|\bin german\b|\ben alem[aá]n\b/i,'de'],
];
const words: Record<ConversationLanguage,RegExp>={
  pt:/\b(quais|ações|estão|segurança|procedimento|explique|isso|atrasadas|devo|seguir)\b/gi,
  es:/\b(qué|cuál|acciones|están|seguridad|procedimiento|debo|seguir|explique)\b/gi,
  en:/\b(what|which|actions|are|safety|procedure|should|follow|explain|overdue)\b/gi,
  fr:/\b(quel|quelle|actions|sécurité|procédure|expliquez)\b/gi,
  de:/\b(welche|maßnahmen|sicherheit|verfahren|erklären)\b/gi,
};
export function detectConversationLanguage(text:string, browserLanguage='en'):ConversationLanguage{
  const scores=Object.entries(words).map(([language,pattern])=>[language,(text.match(pattern)?.length??0)] as const).sort((a,b)=>b[1]-a[1]);
  if(scores[0][1]>0)return scores[0][0] as ConversationLanguage;
  const fallback=browserLanguage.toLowerCase().split('-')[0];return ['en','pt','es','fr','de'].includes(fallback)?fallback as ConversationLanguage:'en';
}
export function requestedResponseLanguage(text:string):ConversationLanguage|undefined{return explicit.find(([pattern])=>pattern.test(text))?.[1];}
export function languageName(language:ConversationLanguage){return ({en:'English',pt:'Português',es:'Español',fr:'Français',de:'Deutsch'})[language];}

