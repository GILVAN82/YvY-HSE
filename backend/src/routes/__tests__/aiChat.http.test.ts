import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { tool } from 'ai';
import { z } from 'zod';
import { createAiChatRouter } from '../aiChat';
import { createMockModel } from '../../ai/__tests__/mockModel';
import { runHseAgent, resetGraphCache } from '../../ai/graph/hseAgent.runner';
import type { PersistedThreadState, ThreadStateStore } from '../../ai/graph/threadState.repository';
import { createHseTools } from '../../ai/tools';

const servers: http.Server[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

class MemoryThreadStore implements ThreadStateStore {
  states = new Map<string, PersistedThreadState>();
  async load(threadId: string) { return this.states.get(threadId) ?? null; }
  async save(state: Omit<PersistedThreadState, 'version' | 'updatedAt'>) {
    this.states.set(state.threadId, { ...structuredClone(state), version: (this.states.get(state.threadId)?.version ?? 0) + 1 });
  }
  async reset(threadId: string) { this.states.delete(threadId); }
}

const memoryService = {
  retrieveRelevant: async () => [],
  save: async () => ({ status: 'REJECTED' as const, reason: 'not enabled in HTTP test' }),
  forget: async () => false,
};

const approvalService = {
  create: async () => { throw new Error('not expected'); },
  resolve: async () => { throw new Error('not expected'); },
  get: async () => null,
  deleteForTest: async () => undefined,
} as any;

async function start(model: any, tools?: any) {
  resetGraphCache();
  const store = new MemoryThreadStore();
  const app = express();
  app.use(express.json());
  app.use('/api', createAiChatRouter({
    resolveModel: () => model,
    readOrchestrator: () => 'langgraph',
    runHseAgent,
    threadStateStore: store,
    longTermMemoryService: memoryService,
    humanApprovalService: approvalService,
    ...(tools ? { tools } : {}),
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { port: address.port, store };
}

async function post(port: number, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const response = await new Promise<string>((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: '/api/ai/chat', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    request.on('error', reject);
    request.end(body);
  });
  return response.split('\n\n').filter(Boolean).map((block) => JSON.parse(block.replace(/^data:\s*/, '')));
}

describe('POST /api/ai/chat HTTP boundary', () => {
  test('invalid request returns a controlled validation category without invoking the model', async () => {
    const model = createMockModel([{ text: 'must not run' }]);
    const { port } = await start(model);
    const response = await post(port, { message: '', history: [], provider: 'openai', model: 'gpt-5.5' });
    assert.equal(response[0].code, 'AI_INVALID_REQUEST');
    assert.equal(model.callCount(), 0);
    assert.doesNotMatch(JSON.stringify(response), /stack|SELECT|system prompt|node_modules|[A-Z]:\\/i);
  });

  test('invokes LangGraph, streams SSE, returns and reuses one threadId', async () => {
    const model = createMockModel([{ text: 'OK' }]);
    const { port, store } = await start(model);
    const first = await post(port, { message: 'Reply with the word OK about HSE.', history: [], provider: 'openai', model: 'gpt-5.5' });
    const firstDone = first.find((event) => event.type === 'done');
    assert.equal(firstDone.status, 'COMPLETED');
    assert.equal(firstDone.orchestrator, 'langgraph');
    assert.match(firstDone.threadId, /^[0-9a-f-]{36}$/i);
    assert.ok(!first.some((event) => event.code === 'AI_MODEL_ERROR'));

    const second = await post(port, { message: 'And again about HSE?', history: [], provider: 'openai', model: 'gpt-5.5', threadId: firstDone.threadId });
    const secondDone = second.find((event) => event.type === 'done');
    assert.equal(secondDone.threadId, firstDone.threadId);
    assert.equal(secondDone.status, 'COMPLETED');
    assert.equal(model.callCount(), 2);
    assert.equal(store.states.size, 1);
  });

  test('completes a synthetic actions tool loop without operational data', async () => {
    const model = createMockModel([
      { toolCall: { name: 'list_actions', input: '{"overdue":true}' } },
      { text: 'Existe uma ação sintética atrasada.' },
    ]);
    const tools = {
      list_actions: tool({
        description: 'Synthetic read-only actions tool for HTTP integration testing.',
        inputSchema: z.object({ overdue: z.boolean() }),
        execute: async () => [{ action_id: 'SYN-001', status: 'Open', target_date: '2026-01-01T00:00:00.000Z' }],
      }),
    };
    const { port } = await start(model, tools);
    const events = await post(port, { message: 'Quais ações estão atrasadas?', history: [], provider: 'openai', model: 'gpt-5.5' });
    const done = events.find((event) => event.type === 'done');
    assert.equal(done.status, 'COMPLETED');
    assert.deepEqual(done.toolsUsed, ['list_actions']);
    assert.equal(done.ragUsed, false);
    assert.ok(events.some((event) => event.type === 'text'));
    assert.ok(!events.some((event) => event.code === 'AI_MODEL_ERROR'));
  });

  test('passes only overdue=true through HTTP and returns the minimized nonzero tool fixture', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const rows = Array.from({ length: 8 }, (_, index) => ({
      action_id: `SYN-${index + 1}`,
      action_description: `Synthetic action ${index + 1}`,
      status: 'Open', target_date: new Date('2026-01-01T00:00:00Z'),
      days_overdue: 10 + index, priority: 'High', source_module: 'Synthetic',
      responsible_person: 'must-not-cross', future_column: 'must-not-cross',
    }));
    const database = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return { rows, rowCount: rows.length } as any;
      },
    };
    const model = createMockModel([
      { toolCall: { name: 'list_actions', input: '{"overdue":true}' } },
      { text: 'Foram encontradas oito ações sintéticas atrasadas.' },
    ]);
    const tools = createHseTools(undefined, undefined, false, database as any);
    const { port } = await start(model, tools);
    const events = await post(port, { message: 'Quais ações estão atrasadas?', history: [], provider: 'openai', model: 'gpt-5.5' });
    const done = events.find((event) => event.type === 'done');

    assert.equal(done.status, 'COMPLETED');
    assert.deepEqual(done.toolsUsed, ['list_actions']);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].params, [20]);
    assert.match(calls[0].sql, /status IS DISTINCT FROM 'Closed'/);
    assert.doesNotMatch(calls[0].sql, /project = \$|status = \$/);

    const secondModelInput = JSON.stringify(model.callInputs()[1]);
    assert.match(secondModelInput, /SYN-1/);
    assert.doesNotMatch(secondModelInput, /must-not-cross|responsible_person|future_column/);
  });

  test('treats the model portfolio wildcard and blank status as no extra SQL filters', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const rows = [{ action_id: 'SYN-WILDCARD', action_description: 'Synthetic overdue action', status: 'Open', target_date: new Date('2026-01-01T00:00:00Z'), days_overdue: 12, priority: 'High', source_module: 'Synthetic' }];
    const database = { query: async (sql: string, params: unknown[] = []) => { calls.push({ sql, params }); return { rows, rowCount: 1 } as any; } };
    const model = createMockModel([
      { toolCall: { name: 'list_actions', input: '{"project":"*","status":"","overdue":true,"limit":20}' } },
      { text: 'Uma ação sintética atrasada.' },
    ]);
    const { port } = await start(model, createHseTools(undefined, undefined, false, database as any));
    const events = await post(port, { message: 'Quais ações estão atrasadas?', history: [], provider: 'openai', model: 'gpt-5.5' });
    assert.equal(events.find((event) => event.type === 'done')?.status, 'COMPLETED');
    assert.deepEqual(calls[0].params, [20]);
    assert.doesNotMatch(calls[0].sql, /project = \$|status = \$/);
  });
});
