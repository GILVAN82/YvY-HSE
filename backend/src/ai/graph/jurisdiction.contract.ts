import type { AgentEvidence } from './evidence.contract';
const fold=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\[[^\]]+\]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const jurisdictions:Record<string,RegExp>={
 PT:/\b(portugal|portuguese|portuguesa?|portuguesas?|pt)\b/,
 US:/\b(united states|estados unidos|us|usa|eua|american)\b/,
 UK:/\b(united kingdom|reino unido|uk|british)\b/,
 BR:/\b(brazil|brasil|brazilian|brasileir[oa])\b/,
 EU:/\b(european union|uniao europeia|eu)\b/,
};
export const isJurisdictionClaim=(text:string)=>/\b(law|legally|jurisdiction|applicability|lei|legalmente|jurisdicao|aplicabilidade)\b/.test(fold(text));

/** A citation's lexical similarity cannot transfer legal applicability to another place. */
export function jurisdictionSupportsClaim(claim:string,evidence:AgentEvidence):boolean{
 if(!isJurisdictionClaim(claim))return true;
 if(!evidence.rag)return false;
 const text=fold(claim),content=fold(evidence.rag.content),scope=fold(evidence.rag.jurisdiction);
 // An explicitly evidenced source limitation is not a conclusion about the other country's law.
 const sourceLimitation=/^this(?: [a-z]+){0,4} source (?:does not establish|cannot establish|does not determine)\b/.test(text);
 if(sourceLimitation)return content.includes(text);
 const targets=Object.entries(jurisdictions).filter(([,pattern])=>pattern.test(text));
 return targets.length>0&&targets.every(([,pattern])=>pattern.test(scope)&&pattern.test(content));
}
