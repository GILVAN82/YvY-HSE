import { timed, logEvent, observeFailure } from '../observability/context';
import { DomainError } from '../observability/errors';
import { supportsPrimaryTopic } from './knowledgeTopics';
import type { EmbeddingService } from './embedding.service';
import type { RagRetrievalRepository } from './retrieval.repository';
import { MAX_RAG_QUERY_LENGTH, readRagRetrievalConfig, type RagRetrievalConfig } from './retrieval.config';
import type { RagRetriever, RagRetrievalResult } from './retrieval.types';
import { EmbeddingProviderError, VectorRetrievalError, LexicalRetrievalError, MalformedRetrievalRowError } from './errors';
import { prepareQuery, lexicalCoverage, lexicalTerms, type QueryPlanner, deterministicQueryPlan } from './queryPlan';
import { reciprocalRankFusion } from './fusion';
import { resolveRetrievalConfig, retrievalConfigFingerprint } from './retrieval.config';
import { isJurisdictionClaim, jurisdictionSupportsClaim } from '../graph/jurisdiction.contract';
import { ragResultEvidence } from '../graph/evidence.contract';
import type { RagEvidence, RetrievalDiagnostics } from './retrieval.types';
import { classifyIntent } from '../intent/intentRouter';

const OPERATIONAL_TERMS = '(incidents?|incidentes?|permits?|actions?|ac(?:ao|oes)|records?|projects?|audits?|inspections?|trainings?|kpis?|indicado(?:r|res)|trir|ltifr)';
const CURRENT_TERMS = '(how many|count|current(?:ly)?|open|closed|overdue|status|today|this month|este mes|quantos?|abert[oa]s?|atrasad[oa]s?|vencid[oa]s?|pendent(?:e|es)|estado|status|recentes?|atuais?|correntes?)';

export function isStructuredOperationalQuery(query: string): boolean {
  const routed = classifyIntent(query);
  if (routed.candidateTools.some((name) => ['get_kpi','list_incidents','list_actions','get_projects'].includes(name))) return true;
  const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return new RegExp(`\\b${CURRENT_TERMS}\\b.{0,80}\\b${OPERATIONAL_TERMS}\\b|\\b${OPERATIONAL_TERMS}\\b.{0,80}\\b${CURRENT_TERMS}\\b`, 'i').test(normalized);
}

export class RagRetrievalService implements RagRetriever {
  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly repository: RagRetrievalRepository,
    private readonly config: RagRetrievalConfig = readRagRetrievalConfig(),
    private readonly log: (entry: Record<string, unknown>) => void = (entry) => { logEvent('rag_retrieval', 'retrieval', { durationMs: Number(entry.latencyMs) }); if (entry.relevanceState === 'RETRIEVAL_UNAVAILABLE') observeFailure(new DomainError('RETRIEVAL', 'RETRIEVAL_UNAVAILABLE', true), 'retrieval'); },
    private readonly planner: QueryPlanner = deterministicQueryPlan
  ) {}

  async retrieve(query: string, options: { requiredSources?: string[] } = {}): Promise<RagRetrievalResult> {
    return timed('retrieval', () => this.retrieveInternal(query, options), 'RETRIEVAL');
  }

  private async retrieveInternal(query: string, options: { requiredSources?: string[] }): Promise<RagRetrievalResult> {
    const started = Date.now();
    const normalized = query.trim();
    if (!normalized || normalized.length > MAX_RAG_QUERY_LENGTH) return { status: 'NO_RELEVANT_EVIDENCE', evidence: [] };
    if (isStructuredOperationalQuery(normalized)) {
      this.log({ event: 'rag_retrieval', used: false, result: 'NOT_APPROPRIATE', count: 0, latencyMs: Date.now() - started });
      return { status: 'NOT_APPROPRIATE', reason: 'STRUCTURED_OPERATIONAL_QUERY', evidence: [] };
    }
    const config = resolveRetrievalConfig(this.config);
    const { plan, reformulationStatus } = await prepareQuery(normalized, this.planner);
    let semantic: RagEvidence[] = [], lexical: RagEvidence[] = [];
    let unavailable = false;
    let retrievalMode: RetrievalDiagnostics['retrievalMode'] = config.fusion === 'RRF' && this.repository.searchLexical ? 'HYBRID' : 'SEMANTIC_ONLY';
    try {
      const vectors = await this.embeddings.embedMany([plan.semanticQuery]);
      if (vectors.length !== 1 || !vectors[0]?.length || vectors[0].some(v => !Number.isFinite(v)))
        throw new MalformedRetrievalRowError('Malformed query embedding');
      semantic = await this.repository.searchByEmbedding(vectors[0], config.semanticCandidateLimit, config.minSimilarity);
    } catch (error) {
      if (!(error instanceof EmbeddingProviderError || error instanceof VectorRetrievalError)) throw error;
      unavailable = true;
      if (config.allowLexicalFallback && config.fusion === 'RRF' && this.repository.searchLexical) retrievalMode = 'LEXICAL_FALLBACK';
      else retrievalMode = 'SEMANTIC_ONLY';
    }
    if (retrievalMode !== 'SEMANTIC_ONLY') {
      try { lexical = await this.repository.searchLexical!(plan.lexicalQuery, config.lexicalCandidateLimit); }
      catch (error) {
        if (!(error instanceof LexicalRetrievalError)) throw error;
        unavailable = true;
        // Never label a degraded vector-only execution hybrid.
        retrievalMode = 'SEMANTIC_ONLY';
      }
    }
    const exactGate = (item: RagEvidence) => plan.exactTerms.every(term => lexicalTerms(item.content).includes(term.toLowerCase()));
    const jurisdictionGate = (item: RagEvidence) => !isJurisdictionClaim(normalized) || jurisdictionSupportsClaim(normalized, ragResultEvidence(item));
    semantic = semantic.filter(item => item.score >= config.minSimilarity && exactGate(item) && supportsPrimaryTopic(plan.originalQuery, item) && jurisdictionGate(item));
    lexical = lexical.filter(item => lexicalCoverage(plan.lexicalQuery, item.content) >= config.lexicalMinCoverage && exactGate(item) && supportsPrimaryTopic(plan.originalQuery, item) && jurisdictionGate(item));
    const evidence = reciprocalRankFusion(semantic, lexical, config.rrfK).slice(0, config.topK);
    const partial = !!options.requiredSources?.some(source => !evidence.some(item => item.sourceId === source));
    const relevanceState: RetrievalDiagnostics['relevanceState'] = !evidence.length
      ? (unavailable ? 'RETRIEVAL_UNAVAILABLE' : 'NO_RELEVANT_EVIDENCE')
      : partial ? 'PARTIAL_REQUIRED_EVIDENCE' : retrievalMode === 'LEXICAL_FALLBACK' ? 'LEXICAL_FALLBACK' : 'RELEVANT_EVIDENCE';
    const diagnostics = { retrievalMode, relevanceState, reformulationStatus, configFingerprint: retrievalConfigFingerprint(config) };
    this.log({ event: 'rag_retrieval', ...diagnostics, count: evidence.length, sourceIds: evidence.map(i => i.sourceId), latencyMs: Date.now() - started });
    if (relevanceState === 'PARTIAL_REQUIRED_EVIDENCE' || relevanceState === 'RETRIEVAL_UNAVAILABLE') return { status: relevanceState, evidence: [], diagnostics };
    return evidence.length ? { status: 'OK', evidence, diagnostics } : { status: 'NO_RELEVANT_EVIDENCE', evidence: [], diagnostics };
  }
}
