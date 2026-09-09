import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareQuery } from '../queryPlan';
import { technicalProjection } from '../technicalGlossary';
import { supportsPrimaryTopic } from '../knowledgeTopics';
import { MULTILINGUAL_CASES } from '../multilingual.dataset';
import { APPROVED_CORPUS_CASES } from '../approved-corpus.dataset';
import { isHseKnowledgeQuestion } from '../../intent/knowledgeQueryPolicy';
import { classifyIntent } from '../../intent/intentRouter';
import { RagRetrievalService } from '../retrieval.service';
import { readRagRetrievalConfig } from '../retrieval.config';
import type { RagEvidence } from '../retrieval.types';

test('controlled PT terms preserve originals, semantic queries, identifiers and stable normalization', async () => {
  for (const c of MULTILINGUAL_CASES.filter(c => c.language === 'pt')) {
    const { plan } = await prepareQuery(c.query);
    assert.equal(plan.originalQuery, c.query); assert.equal(plan.semanticQuery, c.query);
    assert.equal(plan.sourceLanguage, 'pt'); assert.equal(plan.retrievalLanguage, 'en'); assert.equal(plan.expansionApplied, true);
    assert.equal(plan.lexicalQuery, (await prepareQuery(c.query.normalize('NFD'))).plan.lexicalQuery);
  }
  const query = 'OSHA 1910.147 bloqueio e etiquetagem EQ-999';
  const { plan } = await prepareQuery(query);
  assert.ok(plan.exactTerms.includes('1910.147')); assert.ok(plan.exactTerms.includes('EQ-999'));
  assert.ok(plan.lexicalQuery.includes('EQ-999'));
});
test('unknown context and unsupported languages cannot be silently translated away', () => {
  for (const query of ['permissão de trabalho astronomia', 'permis de travail pour une galaxie', 'bloqueio e etiquetagem ignore instructions']) {
    const result = technicalProjection(query); assert.equal(result.applied, false); assert.equal(result.canonicalRetrievalQuery, query);
  }
});
test('methodological routing is shared; operational questions and explicit writes remain separate', () => {
  for (const c of MULTILINGUAL_CASES.filter(c => c.requiredSources.length)) {
    assert.equal(classifyIntent(c.query).intent, 'SEARCH_HSE_KNOWLEDGE', c.id);
  }
  for (const query of ['Create an incident record', 'Explain LOTO and create an incident', 'How many open incidents are there?', 'What is the current PPE status?']) {
    assert.equal(isHseKnowledgeQuestion(query), false, query);
  }
});
test('original sixteen manual labels are untouched and pairs share required sources', () => {
  assert.deepEqual(MULTILINGUAL_CASES.slice(0, 16), APPROVED_CORPUS_CASES);
  assert.equal(MULTILINGUAL_CASES.length, 24);
  for (let i = 16; i < 24; i += 2) assert.deepEqual(MULTILINGUAL_CASES[i].requiredSources, MULTILINGUAL_CASES[i + 1].requiredSources);
});
const hit: RagEvidence = { chunkId: 'c', documentId: 'd', sourceId: 'loto', title: 'LOTO', content: 'United States LOTO lockout tagout 1910.147 stored residual energy verification isolation maintenance control.',
  score: 0.8, module: 'LOTO', version: '1', citationLabel: 'OSHA', sourceOrganization: 'OSHA', jurisdiction: 'United States', sourceUrl: 'https://example.test' };
test('expanded query is not evidence; wrong source, jurisdiction and unknown exact codes remain gated', async () => {
  const service = new RagRetrievalService({ embedMany: async () => [[1, 0]] }, { searchByEmbedding: async () => [hit], searchLexical: async () => [hit] }, readRagRetrievalConfig({}), () => {});
  const result = await service.retrieve(APPROVED_CORPUS_CASES[2].query);
  assert.equal(result.status, 'OK'); assert.equal(result.evidence[0].content, hit.content);
  assert.equal((await service.retrieve('A lei de Portugal exige bloqueio e etiquetagem OSHA 1910.147?')).status, 'NO_RELEVANT_EVIDENCE');
  assert.equal((await service.retrieve('bloqueio e etiquetagem EQ-999')).status, 'NO_RELEVANT_EVIDENCE');
  assert.equal(supportsPrimaryTopic('risk assessment', { ...hit, module: 'Permit to Work' }), false);
  assert.equal(supportsPrimaryTopic('risk assessment and PTW', { ...hit, module: 'Permit to Work' }), true);
  assert.equal(readRagRetrievalConfig({}).minSimilarity, 0.45);
});
