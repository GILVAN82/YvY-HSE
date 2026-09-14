import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidencePresentation } from '../graph/evidencePresentation';
import type { AgentEvidence } from '../graph/evidence.contract';
import type { AgentToolTrace } from '../graph/hseAgent.types';
import type { RagEvidence } from '../rag/retrieval.types';

const tool:AgentToolTrace={name:'list_actions',status:'COMPLETED',arguments:{project:'DEMO-LIS-01'},presentationFacts:{pendingCount:4}};
const evidence=(id:string):AgentEvidence=>({id:'technical-id',sourceType:'TOOL',source:'list_actions',toolName:'list_actions',authority:'OPERATIONAL',resultStatus:'SUCCESS_WITH_DATA',facts:[{path:'data[0].actionId',value:id},{path:'data[0].status',value:'Open'},{path:'data[0].description',value:'private description'},{path:'data[0].responsible_person',value:'private name'}]});
test('business evidence projection includes only business identifiers and supplied project scope',()=>{
  const result=buildEvidencePresentation([evidence('ACT-1')],[tool],[],'2026-09-14T10:00:00Z');
  assert.deepEqual(result.operational[0].items,[{identifier:'ACT-1',status:'Open'}]);assert.equal(result.operational[0].scope,'DEMO-LIS-01');assert.doesNotMatch(JSON.stringify(result),/private|technical-id|responsible_person|recordCount/);
});
test('uncorrelated repeated calls and failed queries never receive guessed record evidence',()=>{
  const result=buildEvidencePresentation([evidence('ACT-1'),evidence('ACT-2')],[tool,{...tool,arguments:{project:'DEMO-LIS-02'}}],[],'time');
  assert.deepEqual(result.operational[0].items,[]);assert.deepEqual(result.operational[1].items,[]);assert.equal(result.operational[1].scope,undefined);
  assert.equal(buildEvidencePresentation([evidence('ACT-1')],[{...tool,status:'ERROR'}],[],'time').operational.length,0);
});
test('RAG projection excludes rankings, embeddings and opaque IDs while retaining source traceability',()=>{
  const doc={title:'Approved guide',content:'Check isolation.',citationLabel:'[LOTO]',sourceOrganization:'OSHA',jurisdiction:'US',version:'1',sourceUrl:'https://www.osha.gov',sourceId:'opaque-source',chunkId:'opaque-chunk',documentId:'opaque-doc',score:.9,fusionScore:12} as RagEvidence;
  const result=buildEvidencePresentation([],[],[doc],'time');assert.equal(result.documents[0].passage,'Check isolation.');assert.equal(result.documents[0].jurisdiction,'US');assert.doesNotMatch(JSON.stringify(result),/opaque|fusionScore|chunkId|score|embedding/);
});
test('missing scope and jurisdiction stay absent and excerpts are bounded',()=>{
  const result=buildEvidencePresentation([], [{...tool,arguments:{project:'*'}}],[{title:'Guide',content:'x'.repeat(2000),citationLabel:'[Guide]'} as RagEvidence],'time');
  assert.equal(result.operational[0].scope,undefined);assert.equal(result.documents[0].jurisdiction,undefined);assert.equal(result.documents[0].passage.length,1601);assert.ok(result.documents[0].passage.endsWith('…'));
});
