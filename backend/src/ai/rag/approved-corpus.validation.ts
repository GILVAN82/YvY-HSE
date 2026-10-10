import assert from 'node:assert/strict';
import { chunkContent, contentHash, normalizeContent } from './textProcessing';
import { corpusFingerprint, fingerprint, stableChunkIdentity, type CorpusConfig } from './identity';
import type { RagSourceDocument } from './types';
import { measureRetrieval } from './retrieval.evaluation';
import type { RetrievalCase } from './retrieval.evaluation';

export type CorpusSnapshot = {
  documents: Array<{ id: string; source_type: string; source_reference: string; version: string; content_hash: string; metadata: Record<string, any> }>;
  chunks: Array<{ id: string; document_id: string; chunk_index: number; content: string; token_count: number; metadata: Record<string, any>; dimensions: number; embedding?: string }>;
};
export function compareCorpus(sources: readonly RagSourceDocument[], snapshot: CorpusSnapshot) {
  const comparisons = sources.map(source => {
    const rows = snapshot.documents.filter(d => d.source_reference === source.sourceReference && d.source_type === source.sourceType);
    const d = rows[0];
    return { sourceId: source.sourceReference, databaseIds: rows.map(r => r.id),
      status: !d ? 'MISSING' : d.version !== source.version ? 'VERSION_CHANGED' : d.content_hash !== contentHash(normalizeContent(source.content)) ? 'CONTENT_CHANGED' : 'MATCH' };
  });
  const unexpected = snapshot.documents.filter(d => !sources.some(s => s.sourceReference === d.source_reference && s.sourceType === d.source_type));
  return [...comparisons, ...unexpected.map(d => ({ sourceId: d.source_reference, databaseIds: [d.id], status: 'UNEXPECTED' }))];
}
export function publicSnapshot(snapshot: CorpusSnapshot) {
  const data = { documents: snapshot.documents, chunks: snapshot.chunks.map(({ embedding, content, ...c }) => ({ ...c, contentHash: contentHash(content) })) };
  return { ...data, documentCount: data.documents.length, chunkCount: data.chunks.length, fingerprint: fingerprint(data) };
}
/** Checks persisted content, configuration identity and provenance, not just document counts. */
export function validateIndexedCorpus(sources: readonly RagSourceDocument[], snapshot: CorpusSnapshot, config: CorpusConfig) {
  assert.equal(snapshot.documents.length, sources.length, 'Unexpected or duplicate documents');
  let expectedChunks = 0;
  const reconstructed = sources.map(source => {
    const documents = snapshot.documents.filter(d => d.source_reference === source.sourceReference && d.source_type === source.sourceType);
    assert.equal(documents.length, 1); const d = documents[0];
    const normalized = normalizeContent(source.content), chunks = chunkContent(normalized, config.chunking);
    const stored = snapshot.chunks.filter(c => c.document_id === d.id).sort((a, b) => a.chunk_index - b.chunk_index);
    expectedChunks += chunks.length; assert.equal(stored.length, chunks.length);
    assert.equal(d.content_hash, contentHash(normalized)); assert.equal(d.version, source.version);
    assert.equal(d.metadata.ingestionFingerprint, fingerprint({ hash: d.content_hash, version: source.version, config, metadata: source.metadata ?? {} }));
    for (const [key, value] of Object.entries(source.metadata ?? {})) assert.equal(d.metadata[key], value, `${source.sourceReference}: ${key}`);
    let content = '', covered = 0;
    chunks.forEach((c, i) => {
      assert.equal(stored[i].chunk_index, i); assert.equal(stored[i].content, c.content);
      assert.equal(stored[i].metadata.stableChunkId, stableChunkIdentity(source, c, config));
      assert.equal(stored[i].dimensions, config.embedding.dimensions); assert.equal(stored[i].token_count, c.tokenCount);
      assert.equal(stored[i].metadata.startOffset, c.metadata.startOffset); assert.equal(stored[i].metadata.endOffset, c.metadata.endOffset);
      content += stored[i].content.slice(covered - Number(c.metadata.startOffset)); covered = Number(c.metadata.endOffset);
    });
    return { ...source, sourceType: d.source_type, sourceReference: d.source_reference, version: d.version, content, metadata: d.metadata };
  });
  assert.equal(snapshot.chunks.length, expectedChunks);
  const actual = corpusFingerprint(reconstructed, config), expected = corpusFingerprint(sources, config);
  assert.equal(actual.fingerprint, expected.fingerprint);
  return { passed: true, corpusFingerprint: actual.fingerprint, embeddingConfigFingerprint: fingerprint(config.embedding),
    stableIds: snapshot.chunks.map(c => c.metadata.stableChunkId).sort(), documentCount: sources.length, chunkCount: expectedChunks };
}
export function retrievalMetrics(cases: Array<{ labels: RetrievalCase; sources: string[] }>) {
  const measured = cases.map(c => measureRetrieval(c.labels, c.sources));
  const sum = (key: 'requiredFound' | 'requiredTotal' | 'relevantFound' | 'relevantTotal' | 'irrelevantFound' | 'retrieved') => measured.reduce((n, c) => n + c[key], 0);
  const positives = measured.filter(c => c.relevantTotal > 0);
  return { requiredSourceRecall: sum('requiredFound') / sum('requiredTotal'), relevantRecallAtK: sum('relevantFound') / sum('relevantTotal'),
    irrelevantRetrievalRate: sum('irrelevantFound') / (sum('retrieved') || 1),
    mrr: positives.reduce((n, c) => n + c.reciprocalRank, 0) / positives.length,
    top1SourceAccuracy: positives.reduce((n, c) => n + c.top1, 0) / positives.length,
    falseAbstentions: measured.filter(c => c.requiredTotal > 0 && c.retrieved === 0).length,
    falseRetrievalsOnNegativeQueries: measured.filter(c => c.relevantTotal === 0 && c.retrieved > 0).length };
}
