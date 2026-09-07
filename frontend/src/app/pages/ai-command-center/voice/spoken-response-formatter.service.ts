import { Injectable } from '@angular/core';
import type { ConversationLanguage, YvyConversationalResponse } from './voice.types';

const copy = {
  pt: { details: 'Os detalhes completos estão na tela.', follow: 'Quer que eu detalhe as ações de prioridade alta?', count: 'Ações exibidas', priorities: ['crítica', 'alta', 'média', 'baixa'], priority: 'Prioridade', days: 'dias de atraso' },
  en: { details: 'Full details are on screen.', follow: 'Would you like details of the high priority actions?', count: 'Actions displayed', priorities: ['critical', 'high', 'medium', 'low'], priority: 'Priority', days: 'days overdue' },
  es: { details: 'Los detalles completos están en pantalla.', follow: '¿Quieres detalles de las acciones de prioridad alta?', count: 'Acciones mostradas', priorities: ['crítica', 'alta', 'media', 'baja'], priority: 'Prioridad', days: 'días de retraso' },
  fr: { details: 'Les détails complets sont à l’écran.', follow: 'Voulez-vous les détails des actions de priorité élevée ?', count: 'Actions affichées', priorities: ['critique', 'élevée', 'moyenne', 'faible'], priority: 'Priorité', days: 'jours de retard' },
  de: { details: 'Die vollständigen Details stehen auf dem Bildschirm.', follow: 'Möchten Sie Details zu den Maßnahmen mit hoher Priorität?', count: 'Angezeigte Maßnahmen', priorities: ['kritisch', 'hoch', 'mittel', 'niedrig'], priority: 'Priorität', days: 'Tage überfällig' },
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const priorityRank = (value: string) => [ ['critical','critica','critico','critique','kritisch'], ['high','alta','alto','elevee','hoch'], ['medium','media','medio','moyenne','mittel'], ['low','baixa','baixo','baja','bajo','faible','niedrig'] ].findIndex(group => group.includes(normalize(value)));

@Injectable({ providedIn: 'root' })
export class SpokenResponseFormatterService {
  format(displayResponse: string, language: ConversationLanguage): YvyConversationalResponse {
    const words = copy[language];
    // Transitional adapter: accept only complete, recognizable action tables from
    // the verified display. Never interpret descriptions or infer missing facts.
    const lines = displayResponse.replace(/\*\*|__/g, '').split(/\r?\n/);
    const table = lines.filter(line => line.includes('|')).map(line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
    const header = table[0]?.map(normalize) ?? [];
    const idIndex = header.findIndex(cell => /^(id|action ?id|acao|action)$/.test(cell));
    const priorityIndex = header.findIndex(cell => /^(prioridade|priority|prioridad|priorite|prioritat)$/.test(cell));
    const daysIndex = header.findIndex(cell => /^(dias atrasada|dias atrasado|dias de atraso|dias em atraso|days overdue|daysoverdue)$/.test(cell));
    const rows = table.slice(1).filter(row => !row.every(cell => /^:?-+:?$/.test(cell)));
    if (rows.length && idIndex >= 0 && priorityIndex >= 0 && rows.every(row => row.length === header.length && /^ACT-\d+$/i.test(row[idIndex]) && priorityRank(row[priorityIndex]) >= 0) && new Set(rows.map(row => row[idIndex])).size === rows.length) {
      const counts = words.priorities.map((_, rank) => rows.filter(row => priorityRank(row[priorityIndex]) === rank).length);
      const selected = [...rows].sort((a,b) => priorityRank(a[priorityIndex]) - priorityRank(b[priorityIndex]));
      const details = (rows.length <= 3 ? selected : selected.filter(row => priorityRank(row[priorityIndex]) <= 1).slice(0,2)).map(row => {
        const days = daysIndex >= 0 && /^\d+$/.test(row[daysIndex]) ? `, ${Number(row[daysIndex])} ${words.days}` : '';
        return `${row[idIndex]}, ${words.priority.toLowerCase()} ${words.priorities[priorityRank(row[priorityIndex])]}${days}.`;
      });
      return { displayResponse, spokenResponse: [`${words.count}: ${rows.length}.`, ...counts.flatMap((count, rank) => count ? [`${words.priority} ${words.priorities[rank]}: ${count}.`] : []), ...details, words.details, ...(rows.length >= 4 ? [words.follow] : [])].join(' ') };
    }
    // Unknown operational tables/JSON stay visual; do not guess their schema.
    const clean = displayResponse
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\{[\s\S]*\}|\[[\s\S]*\]/g, match => /[{}]|"/.test(match) ? '' : match)
      .replace(/^.*\|.*$/gm, '')
      .replace(/^\s*(?:Source|Fonte|Fuente|Verification|Verificação|Evidence|Evidência|Metadata):.*$/gim, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, '')
      .replace(/^\s*[-*_]{3,}\s*$/gm, '')
      .replace(/^\s*(?:#{1,6}\s*|[-*+]\s+|\d+[.)]\s+)/gm, '')
      .replace(/[*_`#<>|]/g, '')
      .trim();
    const structural = /\||```|\{/.test(displayResponse);
    const segments = clean.split(/\n+/).slice(0,3).join(' ').match(/[^.!?]+(?:[.!?]+|$)/g) ?? [];
    let spoken = clean.replace(/\s+/g, ' ');
    if (spoken.length > 260 || clean.split(/\n+/).length > 3) {
      spoken = segments.slice(0,2).join(' ').trim();
      if (spoken.length > 360) spoken = spoken.slice(0,360).replace(/\s+\S*$/, '').trim() + '.';
      spoken += ` ${words.details}`;
    } else if (structural || !spoken) spoken = `${spoken} ${words.details}`.trim();
    return { displayResponse, spokenResponse: spoken };
  }
}
