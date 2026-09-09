import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkContent, DEFAULT_CHUNK_OPTIONS } from '../textProcessing';
import { corpusFingerprint, stableChunkIdentity, type CorpusConfig } from '../identity';
import { reciprocalRankFusion } from '../fusion';
import { prepareQuery } from '../queryPlan';
import { resolveRetrievalConfig, retrievalConfigFingerprint } from '../retrieval.config';
import { RagRetrievalService } from '../retrieval.service';
import { parseRetrievalRow, PostgresRagRetrievalRepository } from '../retrieval.repository';
import { EmbeddingProviderError, ReformulationError, RetrievalConfigError, MalformedRetrievalRowError, VectorRetrievalError, LexicalRetrievalError, isInfrastructureError } from '../errors';
import { OpenAIEmbeddingService } from '../embedding.service';
import type { RagEvidence } from '../retrieval.types';
import type { RagSourceDocument } from '../types';
import { evaluateRetrieval, measureRetrieval, RETRIEVAL_DATASET } from '../retrieval.evaluation';
import { withoutNetwork } from '../../evaluation/offline-network';
import { runHseAgent } from '../../graph/hseAgent.runner';
import { createHseTools } from '../../tools';
import { createMockModel } from '../../evaluation/simulated-model';

const source: RagSourceDocument = { sourceType: 'test', sourceReference: 'A', content: 'LOTO isolation controls',
  title: 'Test', module: 'safety', version: '1', sensitivity: 'public-reference' };
const config: CorpusConfig = { chunking: DEFAULT_CHUNK_OPTIONS, embedding: { provider: 'mock', model: 'fixed', dimensions: 2 }, preprocessing: 'v1' };
const hit = (id = 'A', content = 'LOTO isolation controls'): RagEvidence => ({ chunkId: id, documentId: id,
  sourceId: id, title: id, content, score: 0.8, module: 'safety', version: '1', citationLabel: id,
  sourceOrganization: 'test', jurisdiction: 'United States', sourceUrl: 'https://example.test/' });
for (const [name, input] of Object.entries({ exactMax: 'x'.repeat(4000), maxPlusOne: 'x'.repeat(4001),
  longParagraph: 'word '.repeat(3000), longSentence: 'x'.repeat(15000), paragraphs: 'a\n\nb\n\n'.repeat(1500),
  overlap: 'abcd'.repeat(2400), unicode: '安全 atenção 🛠️\n'.repeat(1500) })) {
  test(`canonical chunks: ${name}, bounded, lossless, deterministic`, () => {
    const chunks = chunkContent(input); assert.deepEqual(chunks, chunkContent(input));
    let reconstructed = '', covered = 0;
    for (const c of chunks) {
      assert.ok(c.tokenCount <= 1000); const start = Number(c.metadata.startOffset), end = Number(c.metadata.endOffset);
      assert.ok(start <= covered); assert.equal(c.content, input.slice(start, end));
      assert.ok(!/^[\uDC00-\uDFFF]/.test(c.content)); assert.ok(!/[\uD800-\uDBFF]$/.test(c.content));
      reconstructed += c.content.slice(covered - start); covered = end;
    }
    assert.equal(reconstructed, input);
  });
}
test('invalid chunk/config fails explicitly', () => {
  assert.throws(() => chunkContent('x', { targetTokens: 2, maxTokens: 1, overlapTokens: 0 }), RetrievalConfigError);
  assert.throws(() => resolveRetrievalConfig({ topK: 0, minSimilarity: 0.5 }), RetrievalConfigError);
});

test('provider configuration and nested transport failures stay distinct', async () => {
  await assert.rejects(new OpenAIEmbeddingService({ model: 'unused', dimensions: 2 }, '').embedMany(['LOTO']), RetrievalConfigError);
  assert.equal(isInfrastructureError({ cause: { code: 'ECONNRESET' } }), true);
  assert.equal(isInfrastructureError({ lastError: { statusCode: 503 } }), true);
  assert.equal(isInfrastructureError({ statusCode: 401 }), false);
  assert.equal(isInfrastructureError(new TypeError('programming error')), false);
});
test('chunk and corpus identities track configuration, content, version; ignore ingestion order', () => {
  const chunk = chunkContent(source.content)[0], id = stableChunkIdentity(source, chunk, config);
  assert.equal(id, stableChunkIdentity(source, chunk, config));
  for (const changed of [{ ...config, preprocessing: 'v2' }, { ...config, embedding: { ...config.embedding, model: 'other' } },
    { ...config, chunking: { ...config.chunking, overlapTokens: 99 } }]) {
    assert.notEqual(id, stableChunkIdentity(source, chunk, changed));
    assert.notEqual(corpusFingerprint([source], config).fingerprint, corpusFingerprint([source], changed).fingerprint);
  }
  assert.notEqual(id, stableChunkIdentity({ ...source, content: 'changed' }, chunk, config));
  const b = { ...source, sourceReference: 'B' };
  assert.equal(corpusFingerprint([source, b], config).fingerprint, corpusFingerprint([b, source], config).fingerprint);
  assert.notEqual(corpusFingerprint([source], config).fingerprint, corpusFingerprint([{ ...source, version: '2' }], config).fingerprint);
  assert.notEqual(retrievalConfigFingerprint({ topK: 3, minSimilarity: 0.45 }), retrievalConfigFingerprint({ topK: 3, minSimilarity: 0.5 }));
});
test('RRF both lists, duplicates, distinct rankings, deterministic ties, empty inputs', () => {
  const a = hit('A'), b = hit('B'), c = hit('C');
  const fused = reciprocalRankFusion([a, a, b], [b, c, a], 60);
  assert.equal(fused.length, 3); assert.equal(fused[0].chunkId, 'B');
  assert.equal(fused[0].fusionScore, 1 / 62 + 1 / 61);
  assert.equal(fused.find(x => x.chunkId === 'A')?.semanticRank, 1);
  assert.equal(reciprocalRankFusion([b], [a], 60)[0].chunkId, 'A');
  assert.equal(reciprocalRankFusion([a], [], 60)[0].fusionScore, 1 / 61);
  assert.equal(reciprocalRankFusion([], [a], 60)[0].lexicalRank, 1);
  assert.deepEqual(reciprocalRankFusion([], [], 60), []);
});
test('query schema and safe original fallback', async () => {
  const query = 'LOTO EQ-123 controls';
  const prepared = await prepareQuery(query);
  assert.deepEqual(prepared.plan.exactTerms, ['EQ-123']); assert.ok(prepared.plan.acronyms.includes('LOTO'));
  for (const planner of [async () => { throw new ReformulationError('timeout'); }, async () => ({} as any)]) {
    const result = await prepareQuery(query, planner);
    assert.equal(result.reformulationStatus, 'FALLBACK_ORIGINAL'); assert.equal(result.plan.semanticQuery, query); assert.equal(result.plan.lexicalQuery, query);
  }
  await assert.rejects(prepareQuery(query, async () => { throw new TypeError('bug'); }), TypeError);
});
test('hybrid relevance, fallback policy, abstention, required sources and programming errors', async () => {
  const make = (semantic: () => Promise<number[][]>, lexical = [hit()], overrides = {}) => new RagRetrievalService(
    { embedMany: semantic }, { searchByEmbedding: async () => [hit()], searchLexical: async () => lexical },
    { ...resolveRetrievalConfig({ topK: 3, minSimilarity: 0.45 }), ...overrides }, () => {});
  const outage = async () => { throw new EmbeddingProviderError('offline'); };
  const normal = await make(async () => [[1, 0]]).retrieve('LOTO isolation controls');
  assert.equal(normal.evidence.length, 1); assert.equal(normal.diagnostics?.retrievalMode, 'HYBRID');
  const fallback = await make(outage).retrieve('LOTO isolation controls');
  assert.equal(fallback.status, 'OK'); assert.equal(fallback.diagnostics?.retrievalMode, 'LEXICAL_FALLBACK');
  assert.equal((await make(outage, [], { allowLexicalFallback: false }).retrieve('LOTO isolation controls')).status, 'RETRIEVAL_UNAVAILABLE');
  assert.equal((await make(outage, [hit('B', 'unrelated holiday')]).retrieve('LOTO isolation controls')).status, 'RETRIEVAL_UNAVAILABLE');
  assert.equal((await make(outage).retrieve('LOTO EQ-123 isolation controls')).status, 'RETRIEVAL_UNAVAILABLE');
  assert.equal((await make(async () => [[1, 0]]).retrieve('LOTO isolation controls', { requiredSources: ['A', 'B'] })).status, 'PARTIAL_REQUIRED_EVIDENCE');
  await assert.rejects(make(async () => { throw new TypeError('bug'); }).retrieve('LOTO isolation controls'), TypeError);
});
test('jurisdiction gate matches E.1: matching, wrong, unspecified, general principle', async () => {
  const service = new RagRetrievalService({ embedMany: async () => [[1, 0]] },
    { searchByEmbedding: async () => [hit('A', 'United States law isolation controls')] }, { topK: 3, minSimilarity: 0.45 }, () => {});
  assert.equal((await service.retrieve('United States law isolation controls')).status, 'OK');
  assert.equal((await service.retrieve('Portugal law isolation controls')).status, 'NO_RELEVANT_EVIDENCE');
  assert.equal((await service.retrieve('law isolation controls')).status, 'NO_RELEVANT_EVIDENCE');
  assert.equal((await service.retrieve('General isolation controls in Portugal')).status, 'OK');
});
test('lexical SQL parameters and malformed rows; narrow near-source errors', async () => {
  let sql = '', parameters: any[] = [];
  const repository = new PostgresRagRetrievalRepository({ query: async (s: string, p: any[]) => { sql = s; parameters = p; return { rows: [] }; } } as any, 2);
  await repository.searchLexical("LOTO EQ-123 ' injected", 12);
  assert.match(sql, /to_tsvector/); assert.match(sql, /\$1::text\[\]/); assert.ok(parameters[0].includes('eq-123')); assert.doesNotMatch(sql, /injected/);
  for (const row of [{}, { score: 'NaN' }, { score: Infinity }]) assert.throws(() => parseRetrievalRow(row), MalformedRetrievalRowError);
  const failed = new PostgresRagRetrievalRepository({ query: async () => { throw Object.assign(new Error('offline'), { code: 'ECONNREFUSED' }); } } as any, 2);
  await assert.rejects(failed.searchLexical('LOTO', 3), LexicalRetrievalError);
  await assert.rejects(failed.searchByEmbedding([1, 0], 3, 0.45), VectorRetrievalError);
  const bug = new PostgresRagRetrievalRepository({ query: async () => { throw new TypeError('bug'); } } as any, 2);
  await assert.rejects(bug.searchLexical('LOTO', 3), TypeError);
});

test('retrieval evaluation is hermetic; required A+B fails when only A is retrieved', async () => {
  const multi = RETRIEVAL_DATASET.find(c => c.id === 'multi-source')!;
  const partial = measureRetrieval(multi, ['loto']);
  assert.equal(partial.passed, false); assert.equal(partial.requiredFound, 1); assert.equal(partial.requiredTotal, 2);
  const result = await withoutNetwork(evaluateRetrieval);
  assert.equal(result.modes.length, 2); assert.equal(result.corpus.documentCount, 3);
  for (const mode of result.modes) {
    assert.equal(mode.cases.find(c => c.id === 'wrong-jurisdiction')?.sources.length, 0);
    assert.equal(mode.cases.find(c => c.id === 'no-evidence')?.sources.length, 0);
    assert.equal(mode.metrics.requiredSourceRecall, 1);
    assert.ok(mode.metrics.irrelevantRetrievalRate > 0, 'The fixture exposes false positives; do not hide them');
  }
  assert.equal(result.modes[0].metrics.irrelevantRetrievalRate, result.modes[1].metrics.irrelevantRetrievalRate);
});

test('corpus fingerprint excludes unknown metadata rather than serializing secrets', () => {
  const dirty = { ...source, metadata: { apiKey: 'not-a-real-secret' } } as RagSourceDocument;
  assert.equal(corpusFingerprint([dirty], config).fingerprint, corpusFingerprint([source], config).fingerprint);
  assert.doesNotMatch(JSON.stringify(corpusFingerprint([dirty], config)), /apiKey|not-a-real-secret/);
});

test('lexical outage is explicit vector-only; disabled fallback never calls lexical', async () => {
  const good = { embedMany: async () => [[1, 0]] };
  const service = new RagRetrievalService(good, { searchByEmbedding: async () => [hit()],
    searchLexical: async () => { throw new LexicalRetrievalError('offline'); } }, { topK: 3, minSimilarity: 0.45 }, () => {});
  assert.equal((await service.retrieve('LOTO isolation')).diagnostics?.retrievalMode, 'SEMANTIC_ONLY');
  let calls = 0;
  const blocked = new RagRetrievalService({ embedMany: async () => { throw new EmbeddingProviderError('offline'); } },
    { searchByEmbedding: async () => [], searchLexical: async () => { calls++; return [hit()]; } },
    { ...resolveRetrievalConfig({ topK: 3, minSimilarity: 0.45 }), allowLexicalFallback: false }, () => {});
  assert.equal((await blocked.retrieve('LOTO isolation')).status, 'RETRIEVAL_UNAVAILABLE'); assert.equal(calls, 0);
});

test('real graph exposes lexical fallback in Inspector diagnostics', async () => {
  const retriever = new RagRetrievalService({ embedMany: async () => { throw new EmbeddingProviderError('offline'); } },
    { searchByEmbedding: async () => [], searchLexical: async () => [hit()] }, { topK: 3, minSimilarity: 0.45 }, () => {});
  const result = await withoutNetwork(() => runHseAgent({ message: 'Explain LOTO isolation controls',
    model: createMockModel([{ toolCall: { name: 'search_hse_knowledge', input: JSON.stringify({ query: 'LOTO isolation controls' }) } },
      { text: 'LOTO isolation controls [A].' }]),
    tools: createHseTools({ query: async () => ({ rows: [] }) } as any, async () => ({}), retriever), emit: () => {},
  }));
  assert.equal(result.executionTrace?.rag.diagnostics?.retrievalMode, 'LEXICAL_FALLBACK');
  assert.equal(result.executionTrace?.rag.diagnostics?.relevanceState, 'LEXICAL_FALLBACK');
});
