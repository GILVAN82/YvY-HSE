import type { AgentEvidence } from './evidence.contract';
import type { AgentToolTrace } from './hseAgent.types';
import type { RagEvidence } from '../rag/retrieval.types';

/** Business evidence only. Technical retrieval and execution fields stay in the trace. */
export interface EvidencePresentation {
  operational: Array<{ source: string; scope?: string; checkedAt: string; items: Array<{ identifier: string; status?: string }> }>;
  documents: Array<{ title: string; citation: string; passage: string; organization?: string; jurisdiction?: string; version?: string; url?: string }>;
}
const identifier = (value: unknown): string | undefined => typeof value==='string' && /^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,79}$/u.test(value) ? value : undefined;
const text = (value: unknown, limit: number): string | undefined => typeof value==='string' && value.trim() ? value.trim().slice(0,limit)+(value.trim().length>limit?'…':'') : undefined;

export function buildEvidencePresentation(evidence: AgentEvidence[], tools: AgentToolTrace[], documents: RagEvidence[], checkedAt: string): EvidencePresentation {
  return {
    operational: tools.flatMap((tool,index)=>{
      if(tool.status!=='COMPLETED' || !tool.presentationFacts)return [];
      const occurrence=tools.slice(0,index).filter(item=>item.name===tool.name).length;
      // The existing trace does not carry call IDs. Repeated calls may finish out of
      // order, so do not guess which record-level evidence belongs to which call.
      const unambiguous=tools.filter(item=>item.name===tool.name).length===1;
      const source=unambiguous ? evidence.filter(item=>item.toolName===tool.name)[occurrence] : undefined;
      const rows=new Map<string,{identifier?:string;status?:string}>();
      // Only business identifiers/status are eligible, never descriptions, names or arbitrary fields.
      for(const fact of source?.facts ?? []) {
        const match=/^data\[(\d+)\]\.(actionId|action_id|incident_id|code|status|investigation_status)$/.exec(fact.path);
        if(!match)continue;
        const row=rows.get(match[1])??{};
        if(['status','investigation_status'].includes(match[2]))row.status=identifier(fact.value);
        else row.identifier=identifier(fact.value);
        rows.set(match[1],row);
      }
      return [{source:tool.name,scope:unambiguous?identifier(tool.arguments?.['project']):undefined,checkedAt,
        items:[...rows.values()].filter((item):item is {identifier:string;status?:string}=>!!item.identifier).slice(0,8)}];
    }),
    documents: documents.slice(0,8).map(item=>({title:text(item.title,200)??'',citation:text(item.citationLabel,200)??'',
      passage:text(item.content,1600)??'',organization:text(item.sourceOrganization,160),jurisdiction:text(item.jurisdiction,160),
      version:text(item.version,80),url:text(item.sourceUrl,1000)})),
  };
}
