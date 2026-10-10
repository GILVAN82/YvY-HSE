export type ModelFailureCategory =
  | 'MODEL_NOT_AVAILABLE'
  | 'INVALID_MODEL_CONFIGURATION'
  | 'AUTHENTICATION_ERROR'
  | 'QUOTA_OR_BILLING_ERROR'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'TOOL_SCHEMA_ERROR'
  | 'MESSAGE_FORMAT_ERROR'
  | 'STREAMING_ERROR'
  | 'PROVIDER_ERROR'
  | 'OTHER';

/** Converts provider errors into log-safe categories. Never return raw provider text. */
function collectErrorChain(error: unknown): any[] {
  const queue: any[] = [error];
  const seen = new Set<unknown>();
  const candidates: any[] = [];
  while (queue.length && candidates.length < 12) {
    const candidate = queue.shift();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    candidates.push(candidate);
    if (candidate.cause) queue.push(candidate.cause);
    if (candidate.error) queue.push(candidate.error);
    if (candidate.data?.error) queue.push(candidate.data.error);
    if (Array.isArray(candidate.errors)) queue.push(...candidate.errors);
    if (candidate.lastError) queue.push(candidate.lastError);
  }
  return candidates;
}

export function classifyModelFailure(error: unknown): ModelFailureCategory {
  const candidates = collectErrorChain(error);
  const status = Math.max(...candidates.map((candidate) =>
    Number(candidate?.statusCode ?? candidate?.status ?? candidate?.response?.status ?? 0)
  ));
  const signal = candidates.map((candidate) =>
    typeof candidate === 'string'
      ? candidate
      : `${candidate?.code ?? ''} ${candidate?.type ?? ''} ${candidate?.message ?? ''} ${candidate?.responseBody ?? ''}`
  ).join(' ').toLowerCase();
  if (status === 401 || /auth|api.?key|unauthorized/.test(signal)) return 'AUTHENTICATION_ERROR';
  if (status === 429 && /quota|billing|credit/.test(signal)) return 'QUOTA_OR_BILLING_ERROR';
  if (status === 429 || /rate.?limit|too many requests/.test(signal)) return 'RATE_LIMIT';
  if (status === 404 || /model.*(not found|does not exist|access)|unknown model/.test(signal)) return 'MODEL_NOT_AVAILABLE';
  if (status === 400 && /model/.test(signal)) return 'INVALID_MODEL_CONFIGURATION';
  if (/timeout|aborted/.test(signal)) return 'TIMEOUT';
  if (/network|fetch failed|econn|enotfound|eacces|eperm/.test(signal)) return 'NETWORK_ERROR';
  if (/tool.{0,30}(schema|invalid)|schema.{0,30}tool/.test(signal)) return 'TOOL_SCHEMA_ERROR';
  if (/invalid (prompt|message)|messages do not match|message format/.test(signal)) return 'MESSAGE_FORMAT_ERROR';
  if (/stream|sse/.test(signal)) return 'STREAMING_ERROR';
  if (status === 400 || /invalid (request|prompt)|type validation/.test(signal)) return 'INVALID_REQUEST';
  if (status >= 500) return 'PROVIDER_ERROR';
  return 'OTHER';
}

export interface SafeModelFailureFingerprint {
  errorType: string;
  httpStatus: number | null;
  providerCode: string | null;
  failureStage: 'MODEL_STREAM';
  category: ModelFailureCategory;
}

export function fingerprintModelFailure(error: unknown): SafeModelFailureFingerprint {
  const candidates = collectErrorChain(error);
  const code = candidates.map((candidate) => candidate?.code).find((value) => typeof value === 'string');
  const status = Math.max(...candidates.map((candidate) =>
    Number(candidate?.statusCode ?? candidate?.status ?? candidate?.response?.status ?? 0)
  ));
  const errorTypes = [...new Set(candidates.map((candidate) =>
    typeof candidate === 'string' ? 'string' : candidate?.constructor?.name ?? typeof candidate
  ))];
  return {
    errorType: errorTypes.join('>'),
    httpStatus: Number.isFinite(status) && status > 0 ? status : null,
    providerCode: typeof code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(code) ? code : null,
    failureStage: 'MODEL_STREAM',
    category: classifyModelFailure(error),
  };
}
