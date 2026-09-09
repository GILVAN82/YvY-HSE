import { corpusFingerprint, stableChunkIdentity, fingerprint, PREPROCESSING_VERSION, type CorpusConfig } from './identity';
import { DEFAULT_CHUNK_OPTIONS } from './textProcessing';
import { validateEmbedding, type EmbeddingService } from './embedding.service';
import { readEmbeddingConfig } from '../embedding.config';
import type { RagRepository } from './rag.repository';
import { EXCLUDED_SOURCE_REGISTRY } from './sourceRegistry';
import { chunkContent, contentHash, detectSuspiciousInstructions, normalizeContent } from './textProcessing';
import type { IngestionSummary, RagSourceDocument } from './types';

export class RagIngestionService {
  constructor(
    private readonly repository: RagRepository,
    private readonly embeddings: EmbeddingService,
    private readonly dimensions = readEmbeddingConfig().dimensions,
    private readonly corpusConfig: CorpusConfig = { chunking: DEFAULT_CHUNK_OPTIONS, embedding: { provider: 'openai', ...readEmbeddingConfig(), dimensions }, preprocessing: PREPROCESSING_VERSION }
  ) {}

  async ingest(sources: readonly RagSourceDocument[], options: { dryRun: boolean }): Promise<IngestionSummary> {
    const summary: IngestionSummary = {
      corpus: corpusFingerprint(sources, this.corpusConfig),
      dryRun: options.dryRun, sourcesExamined: sources.length, sourcesExcluded: EXCLUDED_SOURCE_REGISTRY.length,
      documentsCreated: 0, documentsUpdated: 0, documentsSkipped: 0, chunksCreated: 0,
      embeddingsCreated: 0, warnings: [], errors: [], documents: [],
    };
    for (const source of sources) {
      try {
        if (source.sensitivity !== 'public-reference') throw new Error('Source sensitivity is not approved for ingestion');
        const normalized = normalizeContent(source.content);
        if (!normalized) throw new Error('Source content is empty after normalization');
        const hash = contentHash(normalized);
        const chunks = chunkContent(normalized, this.corpusConfig.chunking);
        const ingestionFingerprint = fingerprint({ hash, version: source.version, config: this.corpusConfig, metadata: source.metadata ?? {} });
        const suspicious = detectSuspiciousInstructions(normalized);
        const flaggedChunks = chunks.map((chunk) => ({
          ...chunk,
          metadata: { ...chunk.metadata, stableChunkId: stableChunkIdentity(source, chunk, this.corpusConfig), ...(suspicious.length ? { suspiciousInstructions: true } : {}) },
        }));
        if (suspicious.length) summary.warnings.push(`${source.sourceReference}: suspicious instruction-like content flagged`);
        summary.documents.push({ title: source.title, module: source.module, sourceReference: source.sourceReference,
          sensitivity: source.sensitivity, normalizedCharacters: normalized.length, chunks: chunks.length, contentHash: hash,
          version: source.version, citationLabel: source.metadata?.citationLabel,
          sourceOrganization: source.metadata?.sourceOrganization, jurisdiction: source.metadata?.jurisdiction });
        if (options.dryRun) continue;
        const existing = await this.repository.findDocument(source.sourceType, source.sourceReference);
        if (existing?.contentHash === hash && existing.version === source.version && existing.ingestionFingerprint === ingestionFingerprint) { summary.documentsSkipped++; continue; }
        const vectors = await this.embeddings.embedMany(chunks.map((chunk) => chunk.content));
        if (vectors.length !== chunks.length) throw new Error('Embedding provider returned an unexpected vector count');
        const stored = await this.repository.replaceDocument(
          { ...source, content: normalized, metadata: { ...source.metadata, ingestionFingerprint } }, hash,
          flaggedChunks.map((chunk, index) => ({ ...chunk, embedding: validateEmbedding(vectors[index], this.dimensions) }))
        );
        if (stored === 'created') summary.documentsCreated++; else summary.documentsUpdated++;
        summary.chunksCreated += chunks.length;
        summary.embeddingsCreated += vectors.length;
      } catch (error) {
        summary.errors.push({ sourceReference: source.sourceReference, message: error instanceof Error ? error.message : 'Unknown ingestion error' });
      }
    }
    return summary;
  }
}
