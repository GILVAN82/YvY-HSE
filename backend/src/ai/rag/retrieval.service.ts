import { OpenAIEmbeddingService, type EmbeddingService } from './embedding.service';
import { PostgresRagRetrievalRepository, type RagRetrievalRepository } from './retrieval.repository';
import { MAX_RAG_QUERY_LENGTH, readRagRetrievalConfig, type RagRetrievalConfig } from './retrieval.config';
import type { RagRetriever, RagRetrievalResult } from './retrieval.types';

const OPERATIONAL_TERMS = '(incidents?|incidentes?|permits?|actions?|ac(?:ao|oes)|records?|projects?|audits?|inspections?|trainings?|kpis?|indicado(?:r|res)|trir|ltifr)';
const CURRENT_TERMS = '(how many|count|current(?:ly)?|open|closed|overdue|status|today|this month|este mes|quantos?|abert[oa]s?|atrasad[oa]s?|vencid[oa]s?|pendent(?:e|es)|estado|status|recentes?|atuais?|correntes?)';

export function isStructuredOperationalQuery(query: string): boolean {
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return new RegExp(`\\b${CURRENT_TERMS}\\b.{0,80}\\b${OPERATIONAL_TERMS}\\b|\\b${OPERATIONAL_TERMS}\\b.{0,80}\\b${CURRENT_TERMS}\\b`, 'i').test(normalized);
}

export class RagRetrievalService implements RagRetriever {
  constructor(
    private readonly embeddings: EmbeddingService = new OpenAIEmbeddingService(),
    private readonly repository: RagRetrievalRepository = new PostgresRagRetrievalRepository(),
    private readonly config: RagRetrievalConfig = readRagRetrievalConfig(),
    private readonly log: (entry: Record<string, unknown>) => void = (entry) => console.info(JSON.stringify(entry))
  ) {}

  async retrieve(query: string): Promise<RagRetrievalResult> {
    const started = Date.now();
    const normalized = query.trim();
    if (!normalized || normalized.length > MAX_RAG_QUERY_LENGTH) return { status: 'NO_RELEVANT_EVIDENCE', evidence: [] };
    if (isStructuredOperationalQuery(normalized)) {
      this.log({ event: 'rag_retrieval', used: false, result: 'NOT_APPROPRIATE', count: 0, latencyMs: Date.now() - started });
      return { status: 'NOT_APPROPRIATE', reason: 'STRUCTURED_OPERATIONAL_QUERY', evidence: [] };
    }
    const [embedding] = await this.embeddings.embedMany([normalized]);
    const evidence = await this.repository.searchByEmbedding(embedding, this.config.topK, this.config.minSimilarity);
    const status = evidence.length ? 'OK' : 'NO_RELEVANT_EVIDENCE';
    this.log({ event: 'rag_retrieval', used: true, result: status, count: evidence.length, sourceIds: evidence.map((item) => item.sourceId), latencyMs: Date.now() - started });
    return evidence.length ? { status: 'OK', evidence } : { status: 'NO_RELEVANT_EVIDENCE', evidence: [] };
  }
}
