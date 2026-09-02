import { Injectable } from '@angular/core';
import type { ConversationLanguage, YvyConversationalResponse } from './voice.types';

const detailNote:Record<ConversationLanguage,string>={en:'The details are available on screen.',pt:'Os detalhes estão disponíveis na tela.',es:'Los detalles están disponibles en pantalla.',fr:'Les détails sont disponibles à l’écran.',de:'Die Details sind auf dem Bildschirm verfügbar.'};
const followUp:Record<ConversationLanguage,string>={en:'Would you like a concise summary?',pt:'Quer um resumo mais curto?',es:'¿Quieres un resumen breve?',fr:'Voulez-vous un résumé concis ?',de:'Möchten Sie eine kurze Zusammenfassung?'};

@Injectable({providedIn:'root'})
export class SpokenResponseFormatterService{
  format(displayResponse:string,language:ConversationLanguage):YvyConversationalResponse{
    const clean=displayResponse.replace(/\[([^\]]+)\]\([^\)]+\)/g,'$1').replace(/^#{1,6}\s+/gm,'').replace(/^\s*(?:Source|Fonte|Fuente|Verification|Verificação):.*$/gim,'').replace(/\s+/g,' ').trim();
    if(clean.length<=260)return {displayResponse,spokenResponse:clean};
    const sentences=clean.match(/[^.!?]+[.!?]+/g)?.map(item=>item.trim())??[clean];
    const summary=sentences.slice(0,2).join(' ').slice(0,360).trim();
    return {displayResponse,spokenResponse:`${summary} ${detailNote[language]} ${followUp[language]}`.trim()};
  }
}
