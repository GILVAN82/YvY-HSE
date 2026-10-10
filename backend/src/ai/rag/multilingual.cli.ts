import '../../config/env.bootstrap';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { MULTILINGUAL_CASES } from './multilingual.dataset';
import { fingerprint, corpusFingerprint, PREPROCESSING_VERSION } from './identity';
import { loadApprovedSources } from './sourceRegistry';
import { DEFAULT_CHUNK_OPTIONS } from './textProcessing';
import { readEmbeddingConfig } from '../embedding.config';
import { OpenAIEmbeddingService, type EmbeddingService } from './embedding.service';
import { validateIndexedCorpus, retrievalMetrics, type CorpusSnapshot } from './approved-corpus.validation';
import { PostgresRagRetrievalRepository } from './retrieval.repository';
import { RagRetrievalService } from './retrieval.service';
import { readRagRetrievalConfig, retrievalConfigFingerprint } from './retrieval.config';
import { prepareQuery, lexicalCoverage } from './queryPlan';
import { reciprocalRankFusion } from './fusion';
import { classifyIntent } from '../intent/intentRouter';
import { provenance } from '../evaluation/evaluation.provenance';
import { createMockModel } from '../evaluation/simulated-model';
import { createHseTools } from '../tools';
import { runHseAgent } from '../graph/hseAgent.runner';

const arg = (key: string) => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1]; };
const write = (file: string, value: unknown) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
/** Neutral measurement driver: final evidence always comes from the production retrieval service. */
async function main() {
  const dir = arg('--run-dir'); assert.ok(dir); fs.mkdirSync(dir, { recursive: true });
  const cacheFile = path.join(dir, 'real-embedding-cache.json');
  const sources = await loadApprovedSources();
  const embedding = { provider: 'openai', ...readEmbeddingConfig() };
  const corpusConfig = { chunking: DEFAULT_CHUNK_OPTIONS, embedding, preprocessing: PREPROCESSING_VERSION };
  const manifest = corpusFingerprint(sources, corpusConfig);
  const nativeFetch = globalThis.fetch;
  const calls: Array<{ host: string; path: string; status: number }> = [];
  if (process.argv.includes('--extend-cache')) {
    assert.ok(!fs.existsSync(cacheFile), 'Cache already exists; evaluation never re-embeds');
    const previous = JSON.parse(fs.readFileSync(arg('--previous-cache')!, 'utf8'));
    assert.equal(previous.corpusFingerprint, manifest.fingerprint);
    assert.equal(previous.embeddingConfigFingerprint, fingerprint(embedding));
    const missing = MULTILINGUAL_CASES.map(c => c.query).filter(q => !previous.queries.includes(q));
    assert.equal(missing.length, 8, 'Exactly eight manually labeled new queries');
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
      const response = await nativeFetch(input, init);
      calls.push({ host: url.host, path: url.pathname, status: response.status }); return response;
    };
    try {
      const added = await new OpenAIEmbeddingService(embedding).embedMany(missing);
      const queries = MULTILINGUAL_CASES.map(c => c.query);
      const vectors = queries.map(q => previous.queries.includes(q) ? previous.vectors[previous.queries.indexOf(q)] : added[missing.indexOf(q)]);
      const cache = { corpusMode: 'REAL APPROVED CORPUS', embeddingMode: 'REAL RETAINED VECTORS',
        datasetFingerprint: fingerprint(MULTILINGUAL_CASES), corpusFingerprint: manifest.fingerprint,
        embeddingConfigFingerprint: fingerprint(embedding), queries, vectors, documents: previous.documents };
      write(cacheFile, { ...cache, fingerprint: fingerprint(cache) });
      write(path.join(dir, 'embedding-calls.json'), { calls, embeddedTexts: missing.length, reusedQueries: 16, generationCalls: 0 });
      console.log(JSON.stringify({ cacheCreated: true, embeddedTexts: missing.length, calls }));
    } finally { globalThis.fetch = nativeFetch; }
    return;
  }
  globalThis.fetch = async () => { throw new Error('HTTP forbidden during retained-vector evaluation'); };
  const db = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const client = await db.connect(); let snapshot: CorpusSnapshot;
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const documents = await client.query('SELECT id::text,source_type,source_reference,version,content_hash,metadata FROM rag_documents ORDER BY source_reference,id');
      const chunks = await client.query('SELECT id::text,document_id::text,chunk_index,content,token_count,metadata,vector_dims(embedding) dimensions,embedding::text FROM rag_chunks ORDER BY document_id,chunk_index');
      snapshot = { documents: documents.rows, chunks: chunks.rows }; await client.query('COMMIT');
    } finally { client.release(); }
    const indexed = validateIndexedCorpus(sources, snapshot, corpusConfig);
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const { fingerprint: retainedFingerprint, ...retainedData } = cache;
    assert.equal(retainedFingerprint, fingerprint(retainedData));
    assert.equal(cache.datasetFingerprint, fingerprint(MULTILINGUAL_CASES));
    assert.equal(cache.corpusFingerprint, indexed.corpusFingerprint);
    assert.equal(cache.embeddingConfigFingerprint, fingerprint(embedding));
    for (const doc of cache.documents) {
      const stored = snapshot.chunks.find(c => c.metadata.stableChunkId === doc.chunkId); assert.ok(stored);
      assert.equal(stored.content, doc.content); assert.deepEqual(JSON.parse(stored.embedding!), doc.embedding);
    }
    const cached: EmbeddingService = { embedMany: async texts => texts.map(q => { const i = cache.queries.indexOf(q); assert.ok(i >= 0, 'Uncached query'); return cache.vectors[i]; }) };
    const repository = new PostgresRagRetrievalRepository(db, embedding.dimensions);
    const config = readRagRetrievalConfig(); assert.equal(config.minSimilarity, 0.45);
    const evaluations = [];
    for (const fusion of ['SEMANTIC_ONLY', 'RRF'] as const) {
      const modeConfig = { ...config, fusion };
      const service = new RagRetrievalService(cached, repository, modeConfig, () => {});
      const cases: Array<{ labels: typeof MULTILINGUAL_CASES[number]; sources: string[]; [key: string]: unknown }> = [];
      for (const labels of MULTILINGUAL_CASES) {
        const prepared = await prepareQuery(labels.query);
        const semantic = await repository.searchByEmbedding((await cached.embedMany([prepared.plan.semanticQuery]))[0], config.semanticCandidateLimit, 0);
        const lexical = await repository.searchLexical(prepared.plan.lexicalQuery, config.lexicalCandidateLimit);
        const result = await service.retrieve(labels.query);
        for (const hit of result.evidence) {
          const stored = cache.documents.find((d: any) => d.chunkId === hit.chunkId); assert.ok(stored);
          assert.equal(hit.content, stored.content, 'Expansion is never evidence');
          assert.equal(hit.sourceId, stored.sourceId);
        }
        const compact = ({ content, ...hit }: any) => hit;
        cases.push({ labels, sources: result.evidence.map(e => e.sourceId), status: result.status, diagnostics: result.diagnostics,
          router: classifyIntent(labels.query), queryPlan: prepared,
          semanticCandidates: semantic.map(e => ({ ...compact(e), passesThreshold: e.score >= config.minSimilarity })),
          lexicalCandidates: lexical.map(e => ({ ...compact(e), coverage: lexicalCoverage(prepared.plan.lexicalQuery, e.content) })),
          ungatedRrfRanking: reciprocalRankFusion(semantic, lexical, config.rrfK).map(compact), evidence: result.evidence.map(compact) });
      }
      evaluations.push({ fusion, config: modeConfig, configFingerprint: retrievalConfigFingerprint(modeConfig), cases,
        metrics: retrievalMetrics(cases), original16: retrievalMetrics(cases.slice(0, 16)),
        byLanguage: ['en', 'pt'].map(language => { const group = cases.filter(c => c.labels.language === language);
          return { language, sampleSize: group.length, positiveQueries: group.filter(c => c.labels.requiredSources.length).length, metrics: retrievalMetrics(group) }; }) });
    }
    const runtimeChecks = [];
    const service = new RagRetrievalService(cached, repository, config, () => {});
    for (const labels of MULTILINGUAL_CASES.filter(c => c.id.startsWith('pair-') && c.language === 'pt')) {
      const direct = await service.retrieve(labels.query);
      const result = await runHseAgent({ message: labels.query,
        model: createMockModel([{ toolCall: { name: 'search_hse_knowledge', input: JSON.stringify({ query: labels.query }) } }, { text: 'Consult the cited reference; no site-specific safety conclusion.' }]),
        tools: createHseTools({ query: async () => { throw new Error('Operational SQL forbidden'); } } as any, async () => ({}), service), emit: () => {} });
      runtimeChecks.push({ id: labels.id, directStatus: direct.status, trace: result.executionTrace?.rag,
        generation: 'SCRIPTED TOOL SELECTION; NOT ANSWER QUALITY EVALUATION' });
      if (arg('--profile')?.startsWith('after')) {
        assert.ok(result.executionTrace?.rag); assert.equal(result.executionTrace.rag.status, direct.status);
        assert.equal(result.executionTrace.rag.diagnostics?.configFingerprint, direct.diagnostics?.configFingerprint);
      }
    }
    const { gitCommit, workingTreeDirty, sourceFingerprint } = provenance(MULTILINGUAL_CASES);
    const report = { timestamp: new Date().toISOString(), profile: arg('--profile'), gitCommit, workingTreeDirty, sourceFingerprint,
      corpusFingerprint: indexed.corpusFingerprint, embeddingConfig: embedding, embeddingConfigFingerprint: fingerprint(embedding),
      datasetFingerprint: fingerprint(MULTILINGUAL_CASES), queryEmbeddingFingerprint: fingerprint(cache.vectors), documentEmbeddingFingerprint: fingerprint(cache.documents),
      sampleSize: 24, threshold: config.minSimilarity, corpusMode: 'REAL APPROVED CORPUS', lexicalMode: 'REAL POSTGRESQL',
      embeddingsMode: 'REAL CACHED VECTORS; HTTP BLOCKED', evaluations, runtimeChecks };
    write(path.join(dir, `${arg('--profile')}.json`), report);
    console.log(JSON.stringify({ profile: report.profile, evaluations: evaluations.map(({ fusion, metrics, byLanguage }) => ({ fusion, metrics, byLanguage })) }, null, 2));
  } finally { globalThis.fetch = nativeFetch; await db.end(); }
}
if (require.main === module) main().catch(error => { console.error({ error: error?.name, message: 'Multilingual validation failed; no credentials logged.', assertion: error?.code === 'ERR_ASSERTION' ? error.message : undefined }); process.exitCode = 1; });
