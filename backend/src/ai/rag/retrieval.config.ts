export const DEFAULT_RAG_TOP_K = 3;
export const DEFAULT_RAG_MIN_SIMILARITY = 0.45;
export const MAX_RAG_QUERY_LENGTH = 500;

export interface RagRetrievalConfig {
  topK: number;
  minSimilarity: number;
}

export function readRagRetrievalConfig(env: NodeJS.ProcessEnv = process.env): RagRetrievalConfig {
  const topK = Number(env.RAG_TOP_K ?? DEFAULT_RAG_TOP_K);
  const minSimilarity = Number(env.RAG_MIN_SIMILARITY ?? DEFAULT_RAG_MIN_SIMILARITY);
  if (!Number.isInteger(topK) || topK < 1 || topK > 10) throw new Error('RAG_TOP_K must be an integer from 1 to 10');
  if (!Number.isFinite(minSimilarity) || minSimilarity < 0 || minSimilarity > 1) throw new Error('RAG_MIN_SIMILARITY must be between 0 and 1');
  return { topK, minSimilarity };
}
