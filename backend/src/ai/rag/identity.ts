import { contentHash, DEFAULT_CHUNK_OPTIONS, normalizeContent } from './textProcessing';
import type { RagSourceDocument, PreparedRagChunk } from './types';

export const PREPROCESSING_VERSION = 'normalize-lines-v1/windows-v2/utf16-estimate-v1';
export type CorpusConfig = {
  chunking: typeof DEFAULT_CHUNK_OPTIONS;
  embedding: { provider: string; model: string; dimensions: number };
  preprocessing: string;
};
export function fingerprint(value: unknown): string {
  const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return contentHash(JSON.stringify(canonical(value)));
}
export function corpusFingerprint(documents: readonly RagSourceDocument[], config: CorpusConfig) {
  const entries = documents.map(d => ({ identity: [d.sourceType, d.sourceReference], version: d.version,
    hash: contentHash(normalizeContent(d.content)), metadata: Object.fromEntries(['language', 'citationLabel', 'sourcePath', 'effectiveDate', 'revisionDate', 'sourceOrganization', 'jurisdiction', 'sourceUrl', 'secondarySourceUrl', 'contentStatus', 'accessedOn'].filter(key => (d.metadata as Record<string, unknown> | undefined)?.[key] !== undefined).map(key => [key, (d.metadata as Record<string, unknown>)[key]])) }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  const manifest = { version: 'corpus-v1', documentCount: entries.length, documents: entries, config };
  return { ...manifest, fingerprint: fingerprint(manifest) };
}
export function stableChunkIdentity(document: RagSourceDocument, chunk: PreparedRagChunk, config: CorpusConfig): string {
  return fingerprint({ sourceType: document.sourceType, sourceReference: document.sourceReference,
    version: document.version, documentHash: contentHash(normalizeContent(document.content)),
    position: chunk.chunkIndex, content: chunk.content, config });
}
