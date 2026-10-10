import { streamText, type TextStreamPart, type ToolSet } from 'ai';
import { z } from 'zod';
import { DomainError, providerFailure, failureDescriptor } from './observability/errors';
import { currentExecution, logEvent, observeFailure, timed } from './observability/context';

const UsageSchema = z.object({ inputTokens: z.number().int().nonnegative().optional(), outputTokens: z.number().int().nonnegative().optional(), totalTokens: z.number().int().nonnegative().optional() });
const ToolCallSchema = z.object({ toolName: z.string().min(1), toolCallId: z.string().min(1), input: z.record(z.string(), z.unknown()) });
export function validateModelPart(part: TextStreamPart<ToolSet>, tools: ToolSet) {
  if (part.type === 'text-delta' && typeof part.text !== 'string') throw new DomainError('MODEL', 'MODEL_INVALID_RESPONSE', false);
  if (part.type === 'tool-call' && ('invalid' in part && part.invalid || !ToolCallSchema.safeParse(part).success || !Object.prototype.hasOwnProperty.call(tools, part.toolName)))
    throw new DomainError('MODEL', 'MODEL_SCHEMA_ERROR', false);
  if (part.type === 'abort') throw new DomainError('MODEL', 'MODEL_TIMEOUT', true);
  if (part.type === 'finish' && !['stop','length','tool-calls','content-filter','error','other','unknown'].includes(part.finishReason)) throw new DomainError('MODEL', 'MODEL_INVALID_RESPONSE', false);
  if (part.type === 'finish' && ['error','unknown','other'].includes(part.finishReason)) throw new DomainError('MODEL', 'MODEL_INVALID_RESPONSE', false);
  if (part.type === 'tool-error') throw failureDescriptor(part.error, 'TOOL');
}
/** The SDK validates provider wire schemas and tool input schemas. This boundary adds
 * application invariants and classifies errors before the graph consumes responses. */
export async function* validatedModelStream(options: Parameters<typeof streamText>[0]): AsyncGenerator<TextStreamPart<ToolSet>> {
  const store = currentExecution(); const started = performance.now();
  let nonempty = false, toolCalls = 0, finished = false;
  logEvent('model_started', 'provider', { provider: store?.observation.provider, model: store?.observation.model });
  try {
    const result = streamText({ ...options, onError: () => undefined });
    for await (const part of result.fullStream) {
      if (part.type === 'error') throw providerFailure(part.error);
      validateModelPart(part, options.tools ?? {});
      if (part.type === 'text-delta') nonempty ||= !!part.text.trim();
      if (part.type === 'tool-call') toolCalls++;
      if (part.type === 'finish') {
        finished = true;
        const usage = UsageSchema.safeParse(part.totalUsage);
        if (store && usage.success && Object.values(usage.data).some(v => v !== undefined)) store.observation.usage = { status: 'AVAILABLE', ...usage.data };
      }
      yield part;
    }
    if (!finished) throw new DomainError('MODEL', 'MODEL_INVALID_RESPONSE', false);
    if (!nonempty && !toolCalls) throw new DomainError('MODEL', 'MODEL_EMPTY_RESPONSE', false);
  } catch (error) { const failure = providerFailure(error); observeFailure(failure, 'provider'); throw failure; }
  finally {
    const durationMs = Math.round((performance.now() - started) * 100) / 100;
    store?.observation.stages.push({ stage: 'provider', durationMs });
    logEvent('model_finished', 'provider', { durationMs, provider: store?.observation.provider, model: store?.observation.model });
  }
}

export function observedTools(tools: ToolSet): ToolSet {
  return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, !tool.execute ? tool : { ...tool,
    execute: async (input: unknown, options: any) => timed(`tool.${name}`, async () => {
      const output = await tool.execute!(input as never, options);
      if (output && typeof output === 'object' && 'error' in output && output.error === true) {
        const code = 'code' in output && typeof output.code === 'string' ? output.code : '';
        const category = /DENIED|RESOURCE_NOT_FOUND/.test(code) ? 'AUTHORIZATION' : /VALID|ARGUMENT/.test(code) ? 'VALIDATION' : /DATABASE|QUERY/.test(code) ? 'DATABASE' : 'TOOL';
        observeFailure(new DomainError(category, category === 'AUTHORIZATION' ? 'ACCESS_DENIED' : `${category}_FAILURE`, false), `tool.${name}`);
      }
      return output;
    }, 'TOOL'),
  }]));
}
