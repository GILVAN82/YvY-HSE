import '../../config/env.bootstrap';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadApprovedSources, RAG_SOURCE_REGISTRY } from './sourceRegistry';
import { DEFAULT_CHUNK_OPTIONS } from './textProcessing';
import { readEmbeddingConfig } from '../embedding.config';
import { corpusFingerprint, fingerprint, PREPROCESSING_VERSION, type CorpusConfig } from './identity';
import { OpenAIEmbeddingService, type EmbeddingService } from './embedding.service';
import { RagIngestionService } from './ingestion.service';
import { PostgresRagRepository } from './rag.repository';
import { PostgresRagRetrievalRepository } from './retrieval.repository';
import { RagRetrievalService } from './retrieval.service';
import { readRagRetrievalConfig, retrievalConfigFingerprint } from './retrieval.config';
import { APPROVED_CORPUS_CASES } from './approved-corpus.dataset';
import { compareCorpus, publicSnapshot, validateIndexedCorpus, retrievalMetrics, type CorpusSnapshot } from './approved-corpus.validation';
import { EmbeddingProviderError } from './errors';
import { provenance } from '../evaluation/evaluation.provenance';
import { createMockModel } from '../evaluation/simulated-model';
import { runHseAgent } from '../graph/hseAgent.runner';
import { createHseTools } from '../tools';

const root = path.resolve(__dirname, '../../../..');
const argument = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const write = (file: string, data: unknown) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
async function snapshot(db: Pool): Promise<CorpusSnapshot> {
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const documents = await client.query('SELECT id::text,source_type,source_reference,version,content_hash,metadata FROM rag_documents ORDER BY source_reference,id');
    const chunks = await client.query('SELECT id::text,document_id::text,chunk_index,content,token_count,metadata,vector_dims(embedding) dimensions,embedding::text FROM rag_chunks ORDER BY document_id,chunk_index');
    await client.query('COMMIT'); return { documents: documents.rows, chunks: chunks.rows };
  } finally { client.release(); }
}
async function main() {
  const sources = await loadApprovedSources(); assert.equal(sources.length, 4);
  const embedding = { provider: 'openai', ...readEmbeddingConfig() };
  const config: CorpusConfig = { chunking: DEFAULT_CHUNK_OPTIONS, embedding, preprocessing: PREPROCESSING_VERSION };
  const manifest = corpusFingerprint(sources, config), retrievalConfig = readRagRetrievalConfig();
  const db = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const dir = argument('--run-dir') ?? path.join(root, 'artifacts/evaluation', `f1-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const externalCalls: Array<{ host: string; path: string; status: number | 'TRANSPORT_ERROR' }> = [];
  const nativeFetch = globalThis.fetch;
  try {
    if (!process.argv.includes('--confirm-live') && !process.argv.includes('--evaluate-cached')) {
      fs.mkdirSync(dir, { recursive: true });
      const before = await snapshot(db), comparisons = compareCorpus(sources, before);
      assert.ok(comparisons.every(c => c.status !== 'UNEXPECTED' && c.databaseIds.length <= 1));
      const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yvy-f1-rag-backup-'));
      write(path.join(backupDir, 'rag-before.json'), before);
      const dryRun = await new RagIngestionService(new PostgresRagRepository(db), { embedMany: async () => { throw new Error('Dry-run must not embed'); } }, embedding.dimensions, config).ingest(sources, { dryRun: true });
      assert.equal(dryRun.errors.length, 0);
      const audit = { timestamp: new Date().toISOString(), gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        approved: RAG_SOURCE_REGISTRY, manifest, embeddingConfigFingerprint: fingerprint(embedding),
        retrievalConfig, retrievalConfigFingerprint: retrievalConfigFingerprint(retrievalConfig),
        dataset: APPROVED_CORPUS_CASES, datasetFingerprint: fingerprint(APPROVED_CORPUS_CASES),
        before: publicSnapshot(before), comparisons, backupDir, dryRun };
      write(path.join(dir, 'before.json'), audit);
      console.log(JSON.stringify({ runDir: dir, comparisons, documents: before.documents.length, chunks: before.chunks.length, embedding, keyConfigured: !!process.env.OPENAI_API_KEY, backupDir }, null, 2));
      return;
    }
    assert.ok(argument('--run-dir'), 'An audited run directory is required');
    const audit = JSON.parse(fs.readFileSync(path.join(dir, 'before.json'), 'utf8'));
    assert.equal(audit.manifest.fingerprint, manifest.fingerprint, 'Approved corpus/config changed since audit');
    assert.equal(audit.datasetFingerprint, fingerprint(APPROVED_CORPUS_CASES), 'Labels changed since audit');
    const retainedCache = path.join(dir, 'real-embedding-cache.json');
    const cacheFile = fs.existsSync(retainedCache) ? retainedCache : path.join(audit.backupDir, 'query-embeddings.json');
    const provider = new OpenAIEmbeddingService(embedding);
    if (process.argv.includes('--evaluate-cached')) globalThis.fetch = async () => { throw new Error('HTTP forbidden during cached evaluation'); };
    if (process.argv.includes('--confirm-live')) {
      assert.ok(!fs.existsSync(path.join(dir, 'ingestion.json')), 'Ingestion already recorded; use --evaluate-cached');
      assert.equal(publicSnapshot(await snapshot(db)).fingerprint, audit.before.fingerprint, 'Database changed since audit');
      globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
        try { const response = await nativeFetch(input, init); externalCalls.push({ host: url.host, path: url.pathname, status: response.status }); return response; }
        catch (error) { externalCalls.push({ host: url.host, path: url.pathname, status: 'TRANSPORT_ERROR' }); throw error; }
      };
      let embeddedTexts = 0;
      const counted: EmbeddingService = { embedMany: async texts => { embeddedTexts += texts.length; return provider.embedMany(texts); } };
      const ingestion = new RagIngestionService(new PostgresRagRepository(db), counted, embedding.dimensions, config);
      const first = await ingestion.ingest(sources, { dryRun: false });
      const sanitized = { ...first, errors: first.errors.map(e => ({ sourceReference: e.sourceReference, message: 'INGESTION_FAILED' })) };
      write(path.join(dir, 'ingestion.json'), { result: sanitized, embeddedTexts });
      assert.equal(first.errors.length, 0, 'Ingestion failed; inspect safe audit and backup');
      const after = await snapshot(db), validation = validateIndexedCorpus(sources, after, config);
      const callsBeforeRepeat = externalCalls.length, textsBeforeRepeat = embeddedTexts;
      const second = await ingestion.ingest(sources, { dryRun: false });
      assert.equal(second.errors.length, 0); assert.equal(second.documentsSkipped, 4);
      const repeated = await snapshot(db), secondValidation = validateIndexedCorpus(sources, repeated, config);
      assert.deepEqual(secondValidation, validation); assert.deepEqual(publicSnapshot(repeated), publicSnapshot(after));
      assert.equal(externalCalls.length, callsBeforeRepeat); assert.equal(embeddedTexts, textsBeforeRepeat);
      write(path.join(dir, 'after.json'), { snapshot: publicSnapshot(after), validation, secondIngestion: second, idempotent: true, extraEmbeddingCallsOnRepeat: 0 });
      // Embed each distinct original query once; reuse exact vectors across modes and threshold probes.
      const queries = APPROVED_CORPUS_CASES.map(c => c.query);
      const vectors = await provider.embedMany(queries);
      write(cacheFile, { datasetFingerprint: fingerprint(APPROVED_CORPUS_CASES), corpusFingerprint: manifest.fingerprint,
        embeddingConfigFingerprint: fingerprint(embedding), queries, vectors });
    }
    const indexedSnapshot = await snapshot(db);
    const indexed = validateIndexedCorpus(sources, indexedSnapshot, config);
    const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    assert.equal(cache.datasetFingerprint, fingerprint(APPROVED_CORPUS_CASES)); assert.equal(cache.corpusFingerprint, manifest.fingerprint);
    assert.equal(cache.embeddingConfigFingerprint, fingerprint(embedding));
    if (cache.documents) for (const document of cache.documents) {
      const stored = indexedSnapshot.chunks.find(c => c.metadata.stableChunkId === document.chunkId);
      assert.ok(stored); assert.equal(stored.content, document.content);
      assert.deepEqual(JSON.parse(stored.embedding!), document.embedding, 'Stored vectors changed since retained baseline');
    }
    const cached: EmbeddingService = { embedMany: async texts => texts.map(query => { const i = cache.queries.indexOf(query); assert.ok(i >= 0); return cache.vectors[i]; }) };
    const repository = new PostgresRagRetrievalRepository(db, embedding.dimensions);
    const evaluations = [];
    for (const threshold of [0.35, retrievalConfig.minSimilarity, 0.55].filter((v, i, all) => all.indexOf(v) === i)) {
      for (const fusion of ['SEMANTIC_ONLY', 'RRF'] as const) {
        const modeConfig = { ...retrievalConfig, minSimilarity: threshold, fusion };
        const retriever = new RagRetrievalService(cached, repository, modeConfig, () => {});
        const cases = [];
        for (const labels of APPROVED_CORPUS_CASES) {
          const result = await retriever.retrieve(labels.query);
          for (const hit of result.evidence) {
            const source = sources.find(s => s.sourceReference === hit.sourceId); assert.ok(source);
            assert.equal(hit.version, source.version); assert.equal(hit.jurisdiction, source.metadata?.jurisdiction);
            assert.equal(hit.citationLabel, source.metadata?.citationLabel); assert.equal(hit.sourceUrl, source.metadata?.sourceUrl);
            assert.ok(indexed.stableIds.includes(hit.chunkId));
          }
          cases.push({ labels, sources: result.evidence.map(e => e.sourceId), status: result.status, diagnostics: result.diagnostics,
            evidence: result.evidence.map(({ content, ...hit }) => hit) });
        }
        evaluations.push({ fusion, threshold, configFingerprint: retrievalConfigFingerprint(modeConfig), cases, metrics: retrievalMetrics(cases) });
      }
    }
    const unavailable: EmbeddingService = { embedMany: async () => { throw new EmbeddingProviderError('Simulated outage; no provider request'); } };
    const fallback = await new RagRetrievalService(unavailable, repository, retrievalConfig, () => {}).retrieve('LOTO');
    assert.equal(fallback.diagnostics?.retrievalMode, 'LEXICAL_FALLBACK'); assert.ok(fallback.evidence.some(e => e.sourceId === 'yvy-kb-loto-osha-1910-147'));
    const empty = await new RagRetrievalService(cached, repository, retrievalConfig, () => {}).retrieve(APPROVED_CORPUS_CASES.find(c => c.id === 'no-evidence')!.query);
    assert.equal(empty.status, 'NO_RELEVANT_EVIDENCE');
    const baselineHybrid = evaluations.find(e => e.threshold === retrievalConfig.minSimilarity && e.fusion === 'RRF')!;
    for (const source of sources) assert.ok(baselineHybrid.cases.some(c => c.evidence.some(e => e.sourceId === source.sourceReference)), 'Each approved source needs a citation trace case');
    const inspectorModes = [];
    for (const scenario of [
      { name: 'HYBRID', service: new RagRetrievalService(cached, repository, retrievalConfig, () => {}), query: APPROVED_CORPUS_CASES[0].query },
      { name: 'SEMANTIC_ONLY', service: new RagRetrievalService(cached, repository, { ...retrievalConfig, fusion: 'SEMANTIC_ONLY' }, () => {}), query: APPROVED_CORPUS_CASES[0].query },
      { name: 'LEXICAL_FALLBACK', service: new RagRetrievalService(unavailable, repository, retrievalConfig, () => {}), query: 'LOTO' },
      { name: 'NO_RELEVANT_EVIDENCE', service: new RagRetrievalService(cached, repository, retrievalConfig, () => {}), query: APPROVED_CORPUS_CASES.find(c => c.id === 'no-evidence')!.query },
    ]) {
      const result = await runHseAgent({ message: 'Explain LOTO reference guidance.',
        model: createMockModel([{ toolCall: { name: 'search_hse_knowledge', input: JSON.stringify({ query: scenario.query }) } }, { text: 'I cannot confirm a site-specific safety decision.' }]),
        tools: createHseTools({ query: async () => { throw new Error('Operational SQL forbidden in corpus validation'); } } as any, async () => ({}), scenario.service), emit: () => {} });
      const trace = result.executionTrace?.rag;
      assert.ok(trace?.diagnostics);
      assert.equal(scenario.name === 'NO_RELEVANT_EVIDENCE' ? trace.status : trace.diagnostics.retrievalMode, scenario.name);
      inspectorModes.push({ scenario: scenario.name, trace, generation: 'SCRIPTED MODEL; NOT ANSWER QUALITY EVALUATION' });
    }
    const { gitCommit, workingTreeDirty, sourceFingerprint } = provenance(APPROVED_CORPUS_CASES, 'SIMULATED', null, null, 1);
    const report = { timestamp: new Date().toISOString(), gitCommit, workingTreeDirty, sourceFingerprint, datasetVersion: 1, generationModel: 'SCRIPTED ONLY FOR INSPECTOR CHECKS', executionProfile: argument('--profile') ?? 'INTEGRATED_WORKSPACE',
      corpusMode: 'REAL APPROVED CORPUS', embeddingsMode: 'REAL EMBEDDINGS, REUSED QUERY VECTORS', lexicalMode: 'REAL POSTGRESQL',
      corpusFingerprint: indexed.corpusFingerprint, embeddingConfig: embedding, embeddingConfigFingerprint: fingerprint(embedding),
      queryEmbeddingFingerprint: fingerprint(cache.vectors),
      indexedEmbeddingFingerprint: fingerprint(indexedSnapshot.chunks.map(c => ({ chunkId: c.metadata.stableChunkId, embedding: JSON.parse(c.embedding!) }))),
      datasetFingerprint: fingerprint(APPROVED_CORPUS_CASES), sampleSize: APPROVED_CORPUS_CASES.length,
      baselineConfig: retrievalConfig, evaluations, citationTracePassed: true,
      failureBehavior: { embeddingOutage: 'INJECTED', fallback: fallback.diagnostics, noEvidenceStatus: empty.status, noEvidenceDiagnostics: empty.diagnostics, inspectorModes } };
    write(path.join(dir, `retrieval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), report);
    console.log(JSON.stringify({ validation: indexed, baseline: evaluations.filter(e => e.threshold === retrievalConfig.minSimilarity).map(e => ({ fusion: e.fusion, metrics: e.metrics })), failureBehavior: report.failureBehavior, externalCalls }, null, 2));
  } finally {
    globalThis.fetch = nativeFetch;
    if (externalCalls.length) write(path.join(dir, `external-calls-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), { calls: externalCalls, total: externalCalls.length });
    await db.end();
  }
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ error: error?.name ?? 'UnknownError', message: 'Corpus validation stopped; inspect retained audit. No credentials are logged.' })); process.exitCode = 1; });
