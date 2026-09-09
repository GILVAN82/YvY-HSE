import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { failureDescriptor, type ErrorCategory } from './errors';
export interface ExecutionContext { runId: string; threadId: string; userId?: string; startedAt: number; locale?: string }
export interface SafeEvent { timestamp: string; level: 'info' | 'warn' | 'error'; event: string; runId: string | null; threadId: string | null; stage: string; promptVersion?: string; promptFingerprint?: string; userIdHash?: string; provider?: string; model?: string; tool?: string; durationMs?: number; errorCategory?: ErrorCategory; errorCode?: string; recoverable?: boolean }
export interface RunObservation { stages: Array<{ stage: string; durationMs: number }>; prompt?: { version: string; fingerprint: string }; provider?: string; model?: string; usage: { status: 'AVAILABLE' | 'NOT_AVAILABLE'; inputTokens?: number; outputTokens?: number; totalTokens?: number }; cost: 'NOT_AVAILABLE'; error?: { category: ErrorCategory; code: string; recoverable: boolean }; }
type Store = { context: Readonly<ExecutionContext>; observation: RunObservation; sink: (event: SafeEvent) => void };
const storage = new AsyncLocalStorage<Store>();
export const currentExecution = () => storage.getStore();
export function withExecution<T>(context: ExecutionContext, action: () => T, sink: (event: SafeEvent) => void = event => console.info(JSON.stringify(event))): T {
  return storage.run({ context: Object.freeze({ ...context }), observation: { stages: [], usage: { status: 'NOT_AVAILABLE' }, cost: 'NOT_AVAILABLE' }, sink }, action);
}
const identifier = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_.:/-]{1,100}$/.test(value) ? value : undefined;
/** Strict projection: callers cannot accidentally log prompts, args, documents or errors. */
export function logEvent(event: string, stage: string, fields: Partial<SafeEvent> = {}) {
  const store = storage.getStore();
  const output: SafeEvent = { timestamp: new Date().toISOString(), level: ['info','warn','error'].includes(fields.level ?? '') ? fields.level! : 'info', event: identifier(event) ?? 'event', stage: identifier(stage) ?? 'unknown',
    runId: store?.context.runId ?? null, threadId: store?.context.threadId ?? null,
    ...(store?.context.userId ? { userIdHash: createHash('sha256').update(store.context.userId).digest('hex').slice(0, 24) } : {}),
    promptVersion: identifier(store?.observation.prompt?.version), promptFingerprint: /^[a-f0-9]{64}$/.test(store?.observation.prompt?.fingerprint ?? '') ? store?.observation.prompt?.fingerprint : undefined,
    provider: identifier(fields.provider ?? store?.observation.provider), model: identifier(fields.model ?? store?.observation.model), tool: identifier(fields.tool ?? (stage.startsWith('tool.') ? stage.slice(5) : undefined)),
    durationMs: Number.isFinite(fields.durationMs) ? Math.max(0, fields.durationMs!) : undefined,
    errorCategory: ['AUTHENTICATION','AUTHORIZATION','VALIDATION','MODEL','RETRIEVAL','TOOL','DATABASE','HITL','VOICE','INTERNAL'].includes(fields.errorCategory ?? '') ? fields.errorCategory : undefined, errorCode: identifier(fields.errorCode), recoverable: fields.recoverable };
  store?.sink(output);
}
export function observeFailure(error: unknown, stage: string, fallback: ErrorCategory = 'INTERNAL') {
  const failure = failureDescriptor(error, fallback), store = storage.getStore();
  if (store) store.observation.error ??= { category: failure.category, code: failure.code, recoverable: failure.recoverable };
  logEvent('stage_failed', stage, { level: 'error', errorCategory: failure.category, errorCode: failure.code, recoverable: failure.recoverable });
  return failure;
}
export async function timed<T>(stage: string, action: () => Promise<T>, fallback: ErrorCategory = 'INTERNAL'): Promise<T> {
  const started = performance.now(); logEvent('stage_started', stage);
  try { return await action(); } catch (error) { observeFailure(error, stage, fallback); throw error; }
  finally { const durationMs = Math.round((performance.now() - started) * 100) / 100;
    const stages = storage.getStore()?.observation.stages; if (stages && stages.length < 100) stages.push({ stage, durationMs });
    logEvent('stage_finished', stage, { durationMs }); }
}
