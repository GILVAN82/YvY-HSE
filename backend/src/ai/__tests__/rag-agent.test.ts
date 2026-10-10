import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHermeticToolFactory, createMockModel } from './mockModel';
import { resetGraphCache, runHseAgent } from '../graph/hseAgent.runner';
import { AgentErrorCode, AgentStatus } from '../graph/hseAgent.types';
import type { RagRetriever } from '../rag/retrieval.types';

const citation = 'OSHA 29 CFR 1910.147 - LOTO';
const retriever: RagRetriever = { retrieve: async () => ({ status: 'OK', evidence: [{
  chunkId: 'c1', documentId: 'd1', content: 'Use isolation and verify zero energy.', score: 0.82,
  sourceId: 'osha-loto', title: 'LOTO', module: 'safety', version: '1', citationLabel: citation,
  sourceOrganization: 'OSHA', jurisdiction: 'United States', sourceUrl: 'https://www.osha.gov/',
}] }) };

describe('controlled RAG graph integration', () => {
  test('evidence reaches state and a real citation passes verification', async () => {
    resetGraphCache();
    const model = createMockModel([
      { toolCall: { name: 'search_hse_knowledge', input: '{"query":"How should LOTO be applied?"}' } },
      { text: `Isole e verifique energia zero [${citation}].` },
    ]);
    const result = await runHseAgent({ message: 'How should LOTO be applied?', model, emit: () => undefined, ragRetriever: retriever, toolFactory: createHermeticToolFactory({ ragRetriever: retriever }) });
    assert.equal(result.status, AgentStatus.COMPLETED);
    assert.equal(result.ragUsed, true);
    assert.equal(result.citations?.[0].sourceId, 'osha-loto');
  });

  test('missing citation fails deterministic grounding verification', async () => {
    resetGraphCache();
    const model = createMockModel([
      { toolCall: { name: 'search_hse_knowledge', input: '{"query":"LOTO guidance"}' } },
      { text: 'Isole e verifique energia zero.' },
    ]);
    const result = await runHseAgent({ message: 'LOTO guidance', model, emit: () => undefined, ragRetriever: retriever, toolFactory: createHermeticToolFactory({ ragRetriever: retriever }) });
    assert.equal(result.status, AgentStatus.FAILED);
    assert.equal(result.errorCode, AgentErrorCode.SEMANTIC_VERIFICATION);
  });

  test('structured data questions cannot invoke the RAG tool', async () => {
    resetGraphCache();
    const model = createMockModel([{ toolCall: { name: 'search_hse_knowledge', input: '{"query":"How many open incidents?"}' } }]);
    const result = await runHseAgent({ message: 'How many open incidents are there?', model, emit: () => undefined, ragRetriever: retriever, toolFactory: createHermeticToolFactory({ ragRetriever: retriever }) });
    assert.equal(result.ragUsed, false);
    assert.notEqual(result.status, AgentStatus.COMPLETED);
  });

  test('compares temporary attachment evidence with approved RAG without ingesting either', async () => {
    resetGraphCache();
    const model=createMockModel([
      {toolCall:{name:'search_hse_knowledge',input:'{"query":"LOTO isolation controls"}'}},
      {text:`The temporary procedure aligns on isolation [Attachment: procedure.pdf, page 1] [${citation}].`},
    ]);
    const result=await runHseAgent({message:'Compare this LOTO procedure with our approved HSE knowledge.',model,emit:()=>undefined,ragRetriever:retriever,toolFactory:createHermeticToolFactory({ragRetriever:retriever}),attachmentContext:'[Attachment: procedure.pdf, page 1]\nApply locks and verify zero energy.'});
    assert.equal(result.status,AgentStatus.COMPLETED); assert.equal(result.ragUsed,true); assert.match(result.text,/Attachment: procedure\.pdf, page 1/);
  });
});
