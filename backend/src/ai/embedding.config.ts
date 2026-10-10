export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

export type EmbeddingConfig = {
  model: string;
  dimensions: number;
};

export function readEmbeddingConfig(env: NodeJS.ProcessEnv = process.env): EmbeddingConfig {
  const model = env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
  const dimensions = Number(env.EMBEDDING_DIMENSIONS || DEFAULT_EMBEDDING_DIMENSIONS);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error('EMBEDDING_DIMENSIONS must be a positive integer');
  }
  return { model, dimensions };
}
