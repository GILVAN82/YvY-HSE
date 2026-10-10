import type { LanguageModel } from 'ai';
import { createHseTools } from '../tools';
import type { RagRetriever } from '../rag/retrieval.types';
import type { MemoryService } from '../memory/memory.types';

/**
 * Scripted language model for tests. Implements just enough of the AI SDK v3 spec for
 * streamText, so the whole agent path can be exercised without an API key, a network
 * call or any cost.
 */
export interface ScriptedStep {
  /** Emit a tool call, which makes the SDK run the real tool and loop again. */
  toolCall?: { name: string; input: string };
  /** Emit assistant text. */
  text?: string;
  /** Throw instead of streaming, to exercise the failure path. */
  error?: string;
}

export function createHermeticToolFactory(options: { ragRetriever?: RagRetriever; memoryService?: MemoryService } = {}) {
  const database = { query: async () => ({ rows: [], rowCount: 0 }) };
  const computeKpi = async () => ({});
  const ragRetriever = options.ragRetriever ?? { retrieve: async () => ({ status: 'NO_RELEVANT_EVIDENCE' as const, evidence: [] }) };
  return (allowMemoryWrite: boolean) => createHseTools(database as any, computeKpi, ragRetriever, options.memoryService, allowMemoryWrite);
}

export function createMockModel(steps: ScriptedStep[]): LanguageModel & { callCount: () => number; callInputs: () => unknown[] } {
  let call = 0;
  const inputs: unknown[] = [];

  const model = {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream(options: unknown) {
      inputs.push(options);
      const step = steps[Math.min(call, steps.length - 1)];
      call++;

      if (step.error) throw new Error(step.error);

      const chunks: any[] = [{ type: 'stream-start', warnings: [] }];

      if (step.toolCall) {
        chunks.push({
          type: 'tool-call',
          toolCallId: `call-${call}`,
          toolName: step.toolCall.name,
          input: step.toolCall.input,
        });
        chunks.push({
          type: 'finish',
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
        });
      } else {
        chunks.push({ type: 'text-start', id: '1' });
        chunks.push({ type: 'text-delta', id: '1', delta: step.text ?? '' });
        chunks.push({ type: 'text-end', id: '1' });
        chunks.push({
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
        });
      }

      return {
        stream: new ReadableStream({
          start(controller) {
            chunks.forEach((c) => controller.enqueue(c));
            controller.close();
          },
        }),
      };
    },
  };

  return Object.assign(model, { callCount: () => call, callInputs: () => inputs }) as unknown as LanguageModel & {
    callCount: () => number;
    callInputs: () => unknown[];
  };
}

/** Inspect role boundaries without snapshotting full prompts in assertions. */
export function capturedContext(model: { callInputs: () => unknown[] }) {
  const input = model.callInputs()[0] as { prompt: Array<{ role: string; content: any }> };
  for (const message of input.prompt.filter(m => m.role === 'user')) {
    const text = typeof message.content === 'string' ? message.content : message.content.find((p: any) => p.type === 'text')?.text;
    try { const data = JSON.parse(text); if (data.kind === 'RUNTIME_DATA_NOT_INSTRUCTIONS') return data; } catch { /* ordinary user text */ }
  }
  throw new Error('Missing structured user context');
}
export function capturedSystem(model: { callInputs: () => unknown[] }): string {
  return (model.callInputs()[0] as any).prompt.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n');
}
