import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApprovedSources } from '../sourceRegistry';
import { APPROVED_CORPUS_CASES } from '../approved-corpus.dataset';
import { compareCorpus, validateIndexedCorpus, publicSnapshot, retrievalMetrics, type CorpusSnapshot } from '../approved-corpus.validation';
import { RagIngestionService } from '../ingestion.service';
import { DEFAULT_CHUNK_OPTIONS } from '../textProcessing';
import { PREPROCESSING_VERSION, type CorpusConfig } from '../identity';
import type { RagRepository } from '../rag.repository';
import { withoutNetwork } from '../../evaluation/offline-network';

test('approved files traverse canonical ingestion twice without duplicate identities or further embeddings', async () => {
  await withoutNetwork(async () => {
    const sources = await loadApprovedSources(), snapshot: CorpusSnapshot = { documents: [], chunks: [] };
    const config: CorpusConfig = { chunking: DEFAULT_CHUNK_OPTIONS, embedding: { provider: 'mock', model: 'hermetic', dimensions: 2 }, preprocessing: PREPROCESSING_VERSION };
    const repo: RagRepository = {
      findDocument: async (type, reference) => {
        const d = snapshot.documents.find(d => d.source_type === type && d.source_reference === reference);
        return d ? { id: d.id, sourceType: type, sourceReference: reference, version: d.version, contentHash: d.content_hash, ingestionFingerprint: d.metadata.ingestionFingerprint } : null;
      },
      replaceDocument: async (s, hash, chunks) => {
        assert.ok(!snapshot.documents.some(d => d.source_reference === s.sourceReference), 'Second ingestion must skip');
        const id = String(snapshot.documents.length + 1);
        snapshot.documents.push({ id, source_type: s.sourceType, source_reference: s.sourceReference, version: s.version, content_hash: hash, metadata: { ...s.metadata } });
        snapshot.chunks.push(...chunks.map(c => ({ id: `${id}-${c.chunkIndex}`, document_id: id, chunk_index: c.chunkIndex, content: c.content, token_count: c.tokenCount, metadata: { ...c.metadata }, dimensions: 2 })));
        return 'created';
      }, counts: async () => ({ documents: snapshot.documents.length, chunks: snapshot.chunks.length }),
    };
    let calls = 0;
    const service = new RagIngestionService(repo, { embedMany: async texts => { calls++; return texts.map(() => [0.5, 0.5]); } }, 2, config);
    assert.equal((await service.ingest(sources, { dryRun: false })).errors.length, 0);
    const first = validateIndexedCorpus(sources, snapshot, config), original = publicSnapshot(snapshot);
    const second = await service.ingest(sources, { dryRun: false });
    assert.equal(second.documentsSkipped, 4); assert.equal(calls, 4);
    assert.deepEqual(validateIndexedCorpus(sources, snapshot, config), first); assert.deepEqual(publicSnapshot(snapshot), original);
    assert.ok(compareCorpus(sources, snapshot).every(c => c.status === 'MATCH'));
    snapshot.chunks[0].metadata.stableChunkId = 'tampered';
    assert.throws(() => validateIndexedCorpus(sources, snapshot, config));
  });
});

test('comparison distinguishes missing, unexpected, content and version changes', async () => {
  const sources = await loadApprovedSources();
  const snapshot: CorpusSnapshot = { documents: [
    { id: '1', source_type: sources[0].sourceType, source_reference: sources[0].sourceReference, version: sources[0].version, content_hash: 'old', metadata: {} },
    { id: '2', source_type: sources[1].sourceType, source_reference: sources[1].sourceReference, version: 'old', content_hash: 'old', metadata: {} },
    { id: '3', source_type: 'unexpected', source_reference: 'unexpected', version: '1', content_hash: 'old', metadata: {} },
  ], chunks: [] };
  assert.deepEqual(compareCorpus(sources, snapshot).map(c => c.status), ['CONTENT_CHANGED', 'VERSION_CHANGED', 'MISSING', 'MISSING', 'UNEXPECTED']);
});

test('multi-source recall does not pass for a single relevant source; negative retrieval is counted', () => {
  const multi = APPROVED_CORPUS_CASES.find(c => c.id === 'distinguish-controls')!;
  const negative = APPROVED_CORPUS_CASES.find(c => c.id === 'no-evidence')!;
  const metrics = retrievalMetrics([{ labels: multi, sources: [multi.requiredSources[0]] }, { labels: negative, sources: [multi.requiredSources[0]] }]);
  assert.equal(metrics.requiredSourceRecall, 0.5); assert.equal(metrics.falseRetrievalsOnNegativeQueries, 1);
  assert.equal(metrics.irrelevantRetrievalRate, 0.5);
});
