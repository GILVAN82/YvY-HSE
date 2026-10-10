import { z } from 'zod';
import { RagRetrievalService } from './retrieval.service';
import { lexicalCoverage } from './queryPlan';
import { corpusFingerprint, fingerprint, PREPROCESSING_VERSION } from './identity';
import { DEFAULT_CHUNK_OPTIONS } from './textProcessing';
import { resolveRetrievalConfig, retrievalConfigFingerprint } from './retrieval.config';
import type { RagEvidence } from './retrieval.types';
import type { RagSourceDocument } from './types';

export const RetrievalCaseSchema = z.object({ id: z.string(), query: z.string(), requiredSources: z.array(z.string()),
  relevantSources: z.array(z.string()), irrelevantSources: z.array(z.string()), jurisdiction: z.string().optional() }).strict();
export type RetrievalCase = z.infer<typeof RetrievalCaseSchema>;
export const RETRIEVAL_DATASET: RetrievalCase[] = [
  { id: 'loto-code', query: 'LOTO EQ-123 isolation', requiredSources: ['loto'], relevantSources: ['loto'], irrelevantSources: ['ptw', 'fire'] },
  { id: 'permit', query: 'PTW permit authorization', requiredSources: ['ptw'], relevantSources: ['ptw'], irrelevantSources: ['fire', 'loto'] },
  { id: 'fire', query: 'fire evacuation assembly', requiredSources: ['fire'], relevantSources: ['fire'], irrelevantSources: ['loto', 'ptw'] },
  { id: 'multi-source', query: 'LOTO PTW isolation authorization', requiredSources: ['loto', 'ptw'], relevantSources: ['loto', 'ptw'], irrelevantSources: ['fire'] },
  { id: 'wrong-jurisdiction', query: 'Portugal law LOTO isolation', requiredSources: [], relevantSources: [], irrelevantSources: ['loto', 'ptw', 'fire'], jurisdiction: 'Portugal' },
  { id: 'no-evidence', query: 'astronomy telescope', requiredSources: [], relevantSources: [], irrelevantSources: ['loto', 'ptw', 'fire'] },
];
export const RETRIEVAL_CORPUS: RagSourceDocument[] = [
  ['loto', 'LOTO EQ-123 isolation United States law'], ['ptw', 'PTW permit authorization United Kingdom'], ['fire', 'fire evacuation assembly United Kingdom'],
].map(([id, content]) => ({ sourceType: 'synthetic', sourceReference: id, module: 'safety', title: id,
  version: '1', sensitivity: 'public-reference', content, metadata: { jurisdiction: id === 'loto' ? 'United States' : 'United Kingdom' } }));
const mockVector = (text: string) => [Number(/LOTO|PTW|isolation|permit|authorization/i.test(text)), Number(/fire|evacuation|assembly/i.test(text))];
const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b) || 1);

export function measureRetrieval(testCase: RetrievalCase, sourceIds: string[]) {
  const ids = [...new Set(sourceIds)];
  const requiredFound = testCase.requiredSources.filter(id => ids.includes(id)).length;
  const relevantFound = testCase.relevantSources.filter(id => ids.includes(id)).length;
  const firstRelevant = ids.findIndex(id => testCase.relevantSources.includes(id));
  return { requiredFound, requiredTotal: testCase.requiredSources.length, relevantFound, relevantTotal: testCase.relevantSources.length,
    irrelevantFound: ids.filter(id => testCase.irrelevantSources.includes(id)).length, retrieved: ids.length,
    reciprocalRank: firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1), top1: firstRelevant === 0 ? 1 : 0,
    passed: requiredFound === testCase.requiredSources.length && !ids.some(id => testCase.irrelevantSources.includes(id)) };
}
export async function evaluateRetrieval() {
  const config = resolveRetrievalConfig({ topK: 3, minSimilarity: 0.45 });
  const manifest = corpusFingerprint(RETRIEVAL_CORPUS, { chunking: DEFAULT_CHUNK_OPTIONS,
    embedding: { provider: 'mock', model: 'two-dimensional-collision-v1', dimensions: 2 }, preprocessing: PREPROCESSING_VERSION });
  const evidence: RagEvidence[] = RETRIEVAL_CORPUS.map(d => ({ chunkId: d.sourceReference, documentId: d.sourceReference,
    sourceId: d.sourceReference, title: d.title, content: d.content, score: 0, module: d.module, version: d.version,
    citationLabel: d.title, sourceOrganization: 'synthetic', jurisdiction: d.metadata!.jurisdiction!, sourceUrl: 'https://example.test/' }));
  const modes = [];
  for (const fusion of ['SEMANTIC_ONLY', 'RRF'] as const) {
    const modeConfig = { ...config, fusion };
    const retriever = new RagRetrievalService({ embedMany: async texts => texts.map(mockVector) }, {
      searchByEmbedding: async (vector, limit, threshold) => evidence.map(e => ({ ...e, score: cosine([...vector], mockVector(e.content)) }))
        .filter(e => e.score >= threshold).sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId)).slice(0, limit),
      searchLexical: async (query, limit) => evidence.map(e => ({ ...e, score: lexicalCoverage(query, e.content) }))
        .filter(e => e.score > 0).sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId)).slice(0, limit),
    }, modeConfig, () => {});
    const cases: Array<ReturnType<typeof measureRetrieval> & { id: string; sources: string[]; status: string; diagnostics: unknown }> = [];
    for (const raw of RETRIEVAL_DATASET) {
      const c = RetrievalCaseSchema.parse(raw), result = await retriever.retrieve(c.query);
      const sources = result.evidence.map(e => e.sourceId);
      cases.push({ id: c.id, sources, status: result.status, diagnostics: result.diagnostics, ...measureRetrieval(c, sources) });
    }
    const sum = (key: 'requiredFound' | 'requiredTotal' | 'relevantFound' | 'relevantTotal' | 'irrelevantFound' | 'retrieved') => cases.reduce((n, c) => n + c[key], 0);
    const positive = cases.filter(c => c.relevantTotal > 0);
    modes.push({ mode: fusion, config: modeConfig, configFingerprint: retrievalConfigFingerprint(modeConfig), cases,
      metrics: { requiredSourceRecall: sum('requiredFound') / sum('requiredTotal'), relevantRecallAtK: sum('relevantFound') / sum('relevantTotal'),
        irrelevantRetrievalRate: sum('irrelevantFound') / (sum('retrieved') || 1),
        mrr: positive.reduce((n, c) => n + c.reciprocalRank, 0) / positive.length,
        top1SourceAccuracy: positive.reduce((n, c) => n + c.top1, 0) / positive.length } });
  }
  return { schemaVersion: 1, datasetFingerprint: fingerprint(RETRIEVAL_DATASET), dataset: RETRIEVAL_DATASET,
    corpusMode: 'SYNTHETIC CORPUS', embeddingsMode: 'MOCK EMBEDDINGS', lexicalMode: 'INJECTED TOKEN COVERAGE FAKE, NOT POSTGRESQL',
    corpus: manifest, comparisonConfigFingerprint: retrievalConfigFingerprint(config), modes };
}
