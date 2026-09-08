import type { ResponseLanguage } from '../responseLanguage';
import type { AgentEvidence } from './evidence.contract';

type Source = { name:string; count?:number; status?:AgentEvidence['resultStatus']; facts:AgentEvidence['facts'] };

const messages = {
  en:{found:(a:number,i:number)=>`I found ${a} pending action${a===1?'':'s'} and ${i} open incident${i===1?'':'s'} in the current scope.`,actions:(n:number)=>`I found ${n} pending action${n===1?'':'s'} in the current scope.`,incidents:(n:number)=>n===0?'No open incidents were found.':`I found ${n} open incident${n===1?'':'s'} in the current scope.`,kpi:'Safety performance data is available.',partial:'Part of the summary still needs confirmation, but the verified data is available below.',details:'Details and evidence are available in each area.'},
  pt:{found:(a:number,i:number)=>`Encontrei ${a} ${a===1?'ação pendente':'ações pendentes'} e ${i} ${i===1?'incidente em aberto':'incidentes em aberto'} no escopo atual.`,actions:(n:number)=>`Encontrei ${n} ${n===1?'ação pendente':'ações pendentes'} no escopo atual.`,incidents:(n:number)=>n===0?'Nenhum incidente em aberto foi encontrado.':`Encontrei ${n} ${n===1?'incidente em aberto':'incidentes em aberto'} no escopo atual.`,kpi:'Dados de desempenho de segurança estão disponíveis.',partial:'Parte do resumo ainda precisa de confirmação, mas os dados verificados estão disponíveis abaixo.',details:'Os detalhes e as evidências estão disponíveis em cada área.'},
  es:{found:(a:number,i:number)=>`Encontré ${a} ${a===1?'acción pendiente':'acciones pendientes'} y ${i} ${i===1?'incidente abierto':'incidentes abiertos'} en el alcance actual.`,actions:(n:number)=>`Encontré ${n} ${n===1?'acción pendiente':'acciones pendientes'} en el alcance actual.`,incidents:(n:number)=>n===0?'No se encontraron incidentes abiertos.':`Encontré ${n} ${n===1?'incidente abierto':'incidentes abiertos'} en el alcance actual.`,kpi:'Los datos de desempeño de seguridad están disponibles.',partial:'Parte del resumen aún necesita confirmación, pero los datos verificados están disponibles abajo.',details:'Los detalles y las evidencias están disponibles en cada área.'},
  fr:{found:(a:number,i:number)=>`J’ai trouvé ${a} action${a===1?'':'s'} en attente et ${i} incident${i===1?' ouvert':'s ouverts'} dans le périmètre actuel.`,actions:(n:number)=>`J’ai trouvé ${n} action${n===1?'':'s'} en attente dans le périmètre actuel.`,incidents:(n:number)=>n===0?'Aucun incident ouvert n’a été trouvé.':`J’ai trouvé ${n} incident${n===1?' ouvert':'s ouverts'} dans le périmètre actuel.`,kpi:'Les données de performance sécurité sont disponibles.',partial:'Une partie du résumé doit encore être confirmée, mais les données vérifiées sont disponibles ci-dessous.',details:'Les détails et les preuves sont disponibles dans chaque section.'},
  de:{found:(a:number,i:number)=>`Ich habe ${a} offene Maßnahme${a===1?'':'n'} und ${i} offene${i===1?'n Vorfall':' Vorfälle'} im aktuellen Bereich gefunden.`,actions:(n:number)=>`Ich habe ${n} offene Maßnahme${n===1?'':'n'} im aktuellen Bereich gefunden.`,incidents:(n:number)=>n===0?'Es wurden keine offenen Vorfälle gefunden.':`Ich habe ${n} offene${n===1?'n Vorfall':' Vorfälle'} im aktuellen Bereich gefunden.`,kpi:'Daten zur Sicherheitsleistung sind verfügbar.',partial:'Ein Teil der Zusammenfassung muss noch bestätigt werden; die verifizierten Daten stehen unten bereit.',details:'Details und Nachweise sind in jedem Bereich verfügbar.'},
} as const;

export function composeOperationalOverview(evidence:AgentEvidence[],language:ResponseLanguage,name?:string):string {
  const source=(tool:string):Source|undefined=>{const item=evidence.find(value=>value.toolName===tool);return item?{name:tool,count:item.recordCount,status:item.resultStatus,facts:item.facts}:undefined;};
  const actions=source('list_actions'),incidents=source('list_incidents'),kpi=source('get_kpi');
  const usable=(item?:Source)=>item&&(item.status==='SUCCESS_WITH_DATA'||item.status==='SUCCESS_NO_DATA');
  const copy=messages[language];const lines:string[]=[];
  if(usable(actions)&&usable(incidents)){
    if((incidents!.count??0)===0)lines.push(copy.actions(actions!.count??0),copy.incidents(0));
    else lines.push(copy.found(actions!.count??0,incidents!.count??0));
  }
  else {if(usable(actions))lines.push(copy.actions(actions!.count??0));if(usable(incidents))lines.push(copy.incidents(incidents!.count??0));}
  if(usable(kpi))lines.push(copy.kpi);
  if([actions,incidents,kpi].some(item=>item?.status==='ERROR'))lines.push(copy.partial);
  lines.push(copy.details);
  const prefix=name?.trim()?`${name.trim()}, `:'';
  return prefix+lines.join(' ');
}

export function operationalPresentationSummary(tool:string,output:unknown,language:ResponseLanguage):string|undefined {
  if(!output||typeof output!=='object')return undefined;const value=output as Record<string,unknown>;
  if(value.error===true)return ({en:'Temporarily unavailable',pt:'Temporariamente indisponível',es:'Temporalmente no disponible',fr:'Temporairement indisponible',de:'Vorübergehend nicht verfügbar'})[language];
  const count=typeof value.recordCount==='number'?value.recordCount:undefined;
  if(tool==='list_actions'&&count!==undefined)return ({en:`${count} pending action${count===1?'':'s'}`,pt:`${count} ${count===1?'ação pendente':'ações pendentes'}`,es:`${count} ${count===1?'acción pendiente':'acciones pendientes'}`,fr:`${count} action${count===1?' en attente':'s en attente'}`,de:`${count} offene Maßnahme${count===1?'':'n'}`})[language];
  if(tool==='list_incidents'&&count!==undefined)return count===0?({en:'No open incidents',pt:'Nenhum incidente em aberto',es:'Ningún incidente abierto',fr:'Aucun incident ouvert',de:'Keine offenen Vorfälle'})[language]:({en:`${count} incident${count===1?'':'s'} found`,pt:`${count} ${count===1?'incidente encontrado':'incidentes encontrados'}`,es:`${count} ${count===1?'incidente encontrado':'incidentes encontrados'}`,fr:`${count} incident${count===1?' trouvé':'s trouvés'}`,de:`${count} Vorfall${count===1?'':'fälle'} gefunden`})[language];
  if(tool==='get_projects'&&count!==undefined)return ({en:`${count} project${count===1?'':'s'} found`,pt:`${count} ${count===1?'projeto encontrado':'projetos encontrados'}`,es:`${count} ${count===1?'proyecto encontrado':'proyectos encontrados'}`,fr:`${count} projet${count===1?' trouvé':'s trouvés'}`,de:`${count} Projekt${count===1?'':'e'} gefunden`})[language];
  if(tool==='get_kpi'){
    if(value.status==='SUCCESS_NO_DATA')return ({en:'No matching performance indicators available',pt:'Nenhum indicador correspondente disponível',es:'No hay indicadores correspondientes disponibles',fr:'Aucun indicateur correspondant disponible',de:'Keine passenden Leistungskennzahlen verfügbar'})[language];
    const data=value.data&&typeof value.data==='object'?value.data as Record<string,unknown>:{};
    const daysSinceLtiLabel=({en:'Days since LTI',pt:'Dias desde LTI',es:'Días desde LTI',fr:'Jours depuis LTI',de:'Tage seit LTI'})[language];
    const parts=[['TRIR',data.trir],['LTIFR',data.ltifr],[daysSinceLtiLabel,data.daysSinceLTI]].filter(([,v])=>typeof v==='number').map(([k,v])=>`${k}: ${v}`);
    return parts.join(' · ')||({en:'Safety performance data available',pt:'Dados de desempenho disponíveis',es:'Datos de desempeño disponibles',fr:'Données de performance disponibles',de:'Daten zur Sicherheitsleistung verfügbar'})[language];
  }
  return undefined;
}
