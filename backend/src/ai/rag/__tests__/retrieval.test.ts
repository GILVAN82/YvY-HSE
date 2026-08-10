import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RagRetrievalService, isStructuredOperationalQuery } from '../retrieval.service';
import { PostgresRagRetrievalRepository } from '../retrieval.repository';

const evidence = {
  chunkId: 'c1', documentId: 'd1', content: 'Apply isolation controls.', score: 0.8,
  sourceId: 'osha-loto', title: 'LOTO', module: 'safety', version: '1',
  citationLabel: 'OSHA 29 CFR 1910.147 - LOTO', sourceOrganization: 'OSHA',
  jurisdiction: 'United States', sourceUrl: 'https://www.osha.gov/',
};

describe('RAG retrieval service', () => {
  test('embeds once and returns ranked traceable evidence', async () => {
    let embedded: readonly string[] = [];
    let args: unknown[] = [];
    const service = new RagRetrievalService(
      { embedMany: async (texts) => { embedded = texts; return [[1, 0]]; } },
      { searchByEmbedding: async (...values) => { args = values; return [evidence]; } },
      { topK: 3, minSimilarity: 0.45 }, () => undefined
    );
    const result = await service.retrieve('How should LOTO be applied?');
    assert.equal(result.status, 'OK');
    assert.deepEqual(embedded, ['How should LOTO be applied?']);
    assert.deepEqual(args, [[1, 0], 3, 0.45]);
    assert.equal(result.evidence[0].citationLabel, evidence.citationLabel);
    assert.ok(!('embedding' in result.evidence[0]));
  });

  test('returns the controlled no-evidence status', async () => {
    const service = new RagRetrievalService(
      { embedMany: async () => [[1, 0]] }, { searchByEmbedding: async () => [] },
      { topK: 3, minSimilarity: 0.45 }, () => undefined
    );
    assert.deepEqual(await service.retrieve('holiday policy'), { status: 'NO_RELEVANT_EVIDENCE', evidence: [] });
  });

  test('does not embed a structured operational query', async () => {
    let calls = 0;
    const service = new RagRetrievalService(
      { embedMany: async () => { calls++; return [[1]]; } }, { searchByEmbedding: async () => [] },
      { topK: 3, minSimilarity: 0.45 }, () => undefined
    );
    const result = await service.retrieve('How many open incidents are there?');
    assert.equal(result.status, 'NOT_APPROPRIATE');
    assert.equal(calls, 0);
  });

  test('classification permits procedural PTW questions', () => {
    assert.equal(isStructuredOperationalQuery('When should a permit-to-work system be used?'), false);
    assert.equal(isStructuredOperationalQuery('What is the status of current permits?'), true);
  });

  test('classifies Portuguese operational entities and keeps English behavior', () => {
    for (const query of [
      'Quais ações estão atrasadas?',
      'Quais acoes estao atrasadas?',
      'Liste as ações vencidas',
      'Existem incidentes recentes?',
      'Quais KPIs estão atuais?',
      'Qual indicador está atrasado?',
      'How many overdue actions are there?',
    ]) assert.equal(isStructuredOperationalQuery(query), true, query);

    assert.equal(isStructuredOperationalQuery('What precautions apply before LOTO?'), false);
  });
});

describe('pgvector repository', () => {
  test('uses positional parameters, cosine distance and does not select embeddings', async () => {
    let sql = ''; let params: unknown[] = [];
    const db = { query: async (query: string, values: unknown[]) => { sql = query; params = values; return { rows: [] }; } } as any;
    await new PostgresRagRetrievalRepository(db, 2).searchByEmbedding([0.1, 0.2], 3, 0.45);
    assert.match(sql, /<=> \$1::vector/);
    assert.match(sql, /WHERE score >= \$2/);
    assert.match(sql, /LIMIT \$3/);
    assert.doesNotMatch(sql, /SELECT[^]*c\.embedding\s*(?:,|FROM)/i);
    assert.deepEqual(params, ['[0.1,0.2]', 0.45, 3]);
  });
});
