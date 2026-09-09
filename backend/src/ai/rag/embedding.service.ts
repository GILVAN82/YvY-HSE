import { EmbeddingProviderError, MalformedRetrievalRowError, RetrievalConfigError, isInfrastructureError } from './errors';
import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { readEmbeddingConfig, type EmbeddingConfig } from '../embedding.config';
import { requireOpenAIConfiguration } from '../../config/env';

export interface EmbeddingService {
  embedMany(texts: readonly string[]): Promise<number[][]>;
}

export function validateEmbedding(vector: readonly number[], dimensions: number): number[] {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some((value) => !Number.isFinite(value))) {
    throw new MalformedRetrievalRowError(`Embedding must contain exactly ${dimensions} finite values`);
  }
  return [...vector];
}

export class OpenAIEmbeddingService implements EmbeddingService {
  constructor(
    private readonly config: EmbeddingConfig = readEmbeddingConfig(),
    private readonly apiKey = process.env.OPENAI_API_KEY
  ) {}

  async embedMany(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey?.trim()) throw new RetrievalConfigError('OPENAI_API_KEY is required for embedding retrieval');
    requireOpenAIConfiguration({ OPENAI_API_KEY: this.apiKey } as NodeJS.ProcessEnv);
    const openai = createOpenAI({ apiKey: this.apiKey });
    let result;
    try { result = await embedMany({ model: openai.embedding(this.config.model as any), values: [...texts] }); }
    catch (error) {
      if (isInfrastructureError(error)) throw new EmbeddingProviderError('Embedding provider unavailable', { cause: error });
      throw error;
    }
    if (result.embeddings.length !== texts.length) throw new MalformedRetrievalRowError('Unexpected embedding count');
    return result.embeddings.map((vector) => validateEmbedding(vector, this.config.dimensions));
  }
}
