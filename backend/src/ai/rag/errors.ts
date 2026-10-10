class RetrievalError extends Error {
  readonly cause?: unknown;
  constructor(message?: string, options?: { cause?: unknown }) { super(message); this.cause = options?.cause; }
}
export class RetrievalConfigError extends RetrievalError { readonly name = 'RetrievalConfigError'; }
export class EmbeddingProviderError extends RetrievalError { readonly name = 'EmbeddingProviderError'; }
export class LexicalRetrievalError extends RetrievalError { readonly name = 'LexicalRetrievalError'; }
export class VectorRetrievalError extends RetrievalError { readonly name = 'VectorRetrievalError'; }
export class MalformedRetrievalRowError extends RetrievalError { readonly name = 'MalformedRetrievalRowError'; }
export class ReformulationError extends RetrievalError { readonly name = 'ReformulationError'; }

/** Only transport/server failures qualify for degradation; programming errors propagate. */
export function isInfrastructureError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 3) return false;
  const code = (error as { code?: string })?.code;
  const status = (error as { statusCode?: number })?.statusCode;
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '57P01', '53300'].includes(code ?? '') ||
    (typeof code === 'string' && code.startsWith('08')) || status === 429 || (typeof status === 'number' && status >= 500) ||
    isInfrastructureError((error as { cause?: unknown }).cause, depth + 1) ||
    isInfrastructureError((error as { lastError?: unknown }).lastError, depth + 1);
}
