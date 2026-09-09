import { z } from 'zod';
import { RetrievalConfigError } from './errors';
import { fingerprint } from './identity';
export const DEFAULT_RAG_TOP_K = 3;
export const DEFAULT_RAG_MIN_SIMILARITY = 0.45;
export const MAX_RAG_QUERY_LENGTH = 500;
// Legacy constructor fields remain accepted; all execution uses this validated model.
export type RagRetrievalConfig = Pick<RetrievalConfig, 'topK' | 'minSimilarity'> & Partial<RetrievalConfig>;
export const RetrievalConfigSchema = z.object({
  version: z.literal('hybrid-v1').default('hybrid-v1'),
  topK: z.number().int().min(1).max(10), minSimilarity: z.number().min(0).max(1),
  semanticCandidateLimit: z.number().int().min(1).max(100).default(12),
  lexicalCandidateLimit: z.number().int().min(1).max(100).default(12),
  rrfK: z.number().int().min(1).max(1000).default(60),
  lexicalMinCoverage: z.number().min(0.5).max(1).default(0.6),
  allowLexicalFallback: z.boolean().default(true),
  fusion: z.enum(['RRF', 'SEMANTIC_ONLY']).default('RRF'),
  lexicalDictionary: z.literal('simple').default('simple'),
  reformulation: z.literal('deterministic-v1').default('deterministic-v1'),
}).strict();
export type RetrievalConfig = z.infer<typeof RetrievalConfigSchema>;
export function resolveRetrievalConfig(input: RagRetrievalConfig): RetrievalConfig {
  const result = RetrievalConfigSchema.safeParse(input);
  if (!result.success) throw new RetrievalConfigError('Invalid retrieval configuration');
  if (result.data.semanticCandidateLimit < result.data.topK || result.data.lexicalCandidateLimit < result.data.topK)
    throw new RetrievalConfigError('Candidate limits must cover final topK');
  return result.data;
}
export function retrievalConfigFingerprint(config: RagRetrievalConfig) { return fingerprint(resolveRetrievalConfig(config)); }
export function readRagRetrievalConfig(env: NodeJS.ProcessEnv = process.env): RetrievalConfig {
  return resolveRetrievalConfig({ topK: Number(env.RAG_TOP_K ?? DEFAULT_RAG_TOP_K),
    minSimilarity: Number(env.RAG_MIN_SIMILARITY ?? DEFAULT_RAG_MIN_SIMILARITY) });
}
