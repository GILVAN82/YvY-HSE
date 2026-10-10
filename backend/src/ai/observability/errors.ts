import { classifyModelFailure } from '../modelFailure';
export type ErrorCategory = 'AUTHENTICATION' | 'AUTHORIZATION' | 'VALIDATION' | 'MODEL' | 'RETRIEVAL' | 'TOOL' | 'DATABASE' | 'HITL' | 'VOICE' | 'INTERNAL';
export type ModelErrorCode = 'MODEL_EMPTY_RESPONSE' | 'MODEL_INVALID_RESPONSE' | 'MODEL_SCHEMA_ERROR' | 'MODEL_TIMEOUT' | 'MODEL_RATE_LIMIT' | 'MODEL_QUOTA_EXHAUSTED' | 'MODEL_AUTH_ERROR' | 'MODEL_PROVIDER_UNAVAILABLE';
export class DomainError extends Error {
  readonly cause?: unknown;
  constructor(public readonly category: ErrorCategory, public readonly code: string, public readonly recoverable: boolean, options?: { cause?: unknown }) {
    super(code); this.name = 'DomainError'; this.cause = options?.cause;
  }
}
export function providerFailure(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const names: string[] = []; let candidate = error as { name?: string; cause?: unknown; lastError?: unknown } | undefined;
  for (let depth=0; candidate && depth<8; depth++) { names.push(String(candidate.name ?? '')); candidate=(candidate.lastError ?? candidate.cause) as typeof candidate; }
  const kinds=names.join(' ');
  if (/EmptyResponseBody/.test(kinds)) return new DomainError('MODEL','MODEL_EMPTY_RESPONSE',false,{cause:error});
  if (/InvalidToolInput|NoSuchTool|NoObjectGenerated|NoOutputGenerated/.test(kinds)) return new DomainError('MODEL','MODEL_SCHEMA_ERROR',false,{cause:error});
  if (/InvalidResponseData|TypeValidation|JSONParse/.test(kinds)) return new DomainError('MODEL','MODEL_INVALID_RESPONSE',false,{cause:error});
  const classification = classifyModelFailure(error);
  if (error instanceof TypeError && classification === 'OTHER') return new DomainError('INTERNAL', 'PROGRAMMING_ERROR', false, { cause: error });
  const code: ModelErrorCode = classification === 'TIMEOUT' ? 'MODEL_TIMEOUT'
    : classification === 'QUOTA_OR_BILLING_ERROR' ? 'MODEL_QUOTA_EXHAUSTED'
    : classification === 'RATE_LIMIT' ? 'MODEL_RATE_LIMIT'
    : classification === 'AUTHENTICATION_ERROR' ? 'MODEL_AUTH_ERROR'
    : classification === 'TOOL_SCHEMA_ERROR' ? 'MODEL_SCHEMA_ERROR'
    : ['INVALID_REQUEST','MESSAGE_FORMAT_ERROR','STREAMING_ERROR'].includes(classification) ? 'MODEL_INVALID_RESPONSE' : 'MODEL_PROVIDER_UNAVAILABLE';
  return new DomainError('MODEL', code, ['MODEL_TIMEOUT','MODEL_RATE_LIMIT','MODEL_PROVIDER_UNAVAILABLE'].includes(code), { cause: error });
}
export function failureDescriptor(error: unknown, fallback: ErrorCategory = 'INTERNAL'): DomainError {
  if (error instanceof DomainError) return error;
  if (error instanceof TypeError || error instanceof ReferenceError) return new DomainError('INTERNAL', 'PROGRAMMING_ERROR', false);
  const value = error as { code?: string; name?: string } | undefined;
  const code = value?.code ?? value?.name ?? '';
  if (/AUTHENTICATION|UNAUTHENTICATED/.test(code)) return new DomainError('AUTHENTICATION', 'AUTHENTICATION_REQUIRED', false);
  if (/DENIED|RESOURCE_NOT_FOUND/.test(code)) return new DomainError('AUTHORIZATION', 'ACCESS_DENIED', false);
  if (/VALIDATION|ZodError/.test(code)) return new DomainError('VALIDATION', 'INVALID_INPUT', false);
  if (/Retrieval|Embedding|Reformulation/.test(code)) return new DomainError('RETRIEVAL', 'RETRIEVAL_FAILURE', true);
  if (/^(08|23|42|53|57)|ECONN|ETIMEDOUT/.test(code)) return new DomainError('DATABASE', 'DATABASE_FAILURE', true);
  return new DomainError(fallback, `${fallback}_FAILURE`, false);
}
