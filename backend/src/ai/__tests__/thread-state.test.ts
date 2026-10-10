import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHermeticToolFactory, createMockModel } from './mockModel';
import { AgentStatus, RefusalCode } from '../graph/hseAgent.types';
import { InvalidThreadIdError, resetGraphCache, runHseAgent } from '../graph/hseAgent.runner';
import { MAX_HISTORY_TURNS } from '../config';
import { minimizeThreadMessages, sanitizePersistedContent, type PersistedThreadState, type ThreadStateStore } from '../graph/threadState.repository';
import type { RagRetriever } from '../rag/retrieval.types';

class MemoryThreadStore implements ThreadStateStore {
  states = new Map<string, PersistedThreadState>();
  async load(id: string, userId: string) { const state = this.states.get(id); return structuredClone(state?.userId === userId ? state : null); }
  async save(state: Omit<PersistedThreadState, 'version' | 'updatedAt'>) {
    const old = this.states.get(state.threadId);
    this.states.set(state.threadId, { ...structuredClone(state), messages: minimizeThreadMessages(state.messages), version: (old?.version ?? 0) + 1 });
  }
  async reset(id: string, userId: string) { if (this.states.get(id)?.userId === userId) this.states.delete(id); }
}

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = '11111111-1111-4111-8111-111111111111';
const emit = () => undefined;

function serializedMessages(model: ReturnType<typeof createMockModel>): string {
  const inputs = model.callInputs() as Array<{ prompt?: Array<{ role?: string; content?: unknown }> }>;
  return JSON.stringify(inputs.flatMap((input) => input.prompt?.filter((message) => message.role !== 'system') ?? []));
}

describe('persistent thread-scoped state', () => {
  test('a new thread starts empty and persists a completed turn', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    assert.equal(await store.load(A, '00000000-0000-4000-8000-000000000000'), null);
    await runHseAgent({ threadId: A, message: 'LOTO precautions?', model: createMockModel([{ text: 'Use isolation.' }]), emit, threadStore: store });
    assert.deepEqual(store.states.get(A)?.messages.map((m) => m.role), ['user', 'assistant']);
  });

  test('same thread restores context across invocation boundaries', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'Discuss LOTO.', model: createMockModel([{ text: 'LOTO context.' }]), emit, threadStore: store });
    const followUp = createMockModel([{ text: 'Restore energy after checks.' }]);
    await runHseAgent({ threadId: A, message: 'What about restoring energy after LOTO?', model: followUp, emit, threadStore: store });
    const input = serializedMessages(followUp);
    assert.match(input, /Discuss LOTO/); assert.match(input, /LOTO context/); assert.match(input, /restoring energy/);
  });

  test('same-thread LOTO context authorizes an otherwise ambiguous restoration follow-up', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'What precautions should be taken before performing lockout/tagout?', model: createMockModel([{ text: 'Isolate and verify zero energy.' }]), emit, threadStore: store });
    const followUp = createMockModel([{ text: 'Restore energy only after controlled verification.' }]);
    const result = await runHseAgent({ threadId: A, message: 'What about restoring energy afterward?', model: followUp, emit, threadStore: store });
    assert.equal(result.status, AgentStatus.COMPLETED);
    assert.match(serializedMessages(followUp), /lockout\/tagout/);
  });

  test('same-thread LOTO context authorizes isolation verifier follow-up', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'Explain LOTO precautions.', model: createMockModel([{ text: 'Verify isolation.' }]), emit, threadStore: store });
    const result = await runHseAgent({ threadId: A, message: 'And who should verify the isolation?', model: createMockModel([{ text: 'An authorized role verifies it.' }]), emit, threadStore: store });
    assert.equal(result.status, AgentStatus.COMPLETED);
  });

  test('referential follow-up inherits only the same thread HSE scope', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'Quais ações estão atrasadas?', model: createMockModel([{ text: 'Ações A e B.' }]), emit, threadStore: store });
    const followUp = createMockModel([{ text: 'A ação B está mais atrasada.' }]);
    const result = await runHseAgent({ threadId: A, message: 'Qual delas está mais atrasada?', model: followUp, emit, threadStore: store });
    assert.equal(result.status, AgentStatus.COMPLETED);
    assert.match(serializedMessages(followUp), /Quais ações estão atrasadas/);
  });

  test('HSE history does not authorize an unrelated general-knowledge turn', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'What precautions apply before LOTO?', model: createMockModel([{ text: 'Isolate energy.' }]), emit, threadStore: store });
    const unrelated = createMockModel([{ text: 'must not be called' }]);
    const before = JSON.stringify(store.states.get(A));
    const result = await runHseAgent({ threadId: A, message: 'Quem é o presidente do Brasil?', model: unrelated, emit, threadStore: store });
    assert.equal(result.status, AgentStatus.REFUSED);
    assert.equal(result.refusalReason, RefusalCode.OUT_OF_SCOPE);
    assert.equal(unrelated.callInputs().length, 0);
    assert.equal(JSON.stringify(store.states.get(A)), before);
  });

  for (const unrelatedInput of ['Write a poem.', 'What is the weather today?']) {
    test(`HSE history refuses unrelated contextual-looking request: ${unrelatedInput}`, async () => {
      resetGraphCache(); const store = new MemoryThreadStore();
      await runHseAgent({ threadId: A, message: 'Explain LOTO precautions.', model: createMockModel([{ text: 'LOTO context.' }]), emit, threadStore: store });
      const model = createMockModel([{ text: 'must not run' }]);
      const result = await runHseAgent({ threadId: A, message: unrelatedInput, model, emit, threadStore: store });
      assert.equal(result.status, AgentStatus.REFUSED);
      assert.equal(result.refusalReason, RefusalCode.OUT_OF_SCOPE);
      assert.equal(model.callInputs().length, 0);
    });
  }

  test('LOTO context in thread A cannot authorize ambiguous follow-up in thread B', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'Explain LOTO precautions.', model: createMockModel([{ text: 'LOTO context.' }]), emit, threadStore: store });
    const modelB = createMockModel([{ text: 'must not run' }]);
    const result = await runHseAgent({ threadId: B, message: 'What about restoring energy afterward?', model: modelB, emit, threadStore: store });
    assert.equal(result.status, AgentStatus.COMPLETED);
    assert.equal(result.executionTrace?.intent?.clarificationRequired, true);
    assert.equal(modelB.callInputs().length, 0);
  });

  test('long-term memory is not consulted to authorize an ambiguous follow-up', async () => {
    resetGraphCache(); let memoryCalls = 0;
    const result = await runHseAgent({
      threadId: B,
      message: 'What about restoring energy afterward?',
      model: createMockModel([{ text: 'must not run' }]), emit,
      threadStore: new MemoryThreadStore(),
      memoryService: { retrieveRelevant: async () => { memoryCalls++; return [{ memoryKey:'loto', category:'preference', content:'LOTO context' }]; } } as any,
    });
    assert.equal(result.status, AgentStatus.COMPLETED);
    assert.equal(result.executionTrace?.intent?.clarificationRequired, true);
    assert.equal(memoryCalls, 0);
  });

  test('different threads are isolated and returning to A restores A', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'LOTO topic', model: createMockModel([{ text: 'LOTO answer' }]), emit, threadStore: store });
    const modelB = createMockModel([{ text: 'Emergency answer' }]);
    await runHseAgent({ threadId: B, message: 'Emergency topic', model: modelB, emit, threadStore: store });
    assert.doesNotMatch(serializedMessages(modelB), /LOTO/);
    const returnA = createMockModel([{ text: 'Isolation verifier answer' }]);
    await runHseAgent({ threadId: A, message: 'Who verifies LOTO isolation?', model: returnA, emit, threadStore: store });
    assert.match(serializedMessages(returnA), /LOTO topic/);
    assert.doesNotMatch(serializedMessages(returnA), /Emergency topic/);
  });

  test('RAG citations remain traceable but chunks and vectors are not persisted', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    const label = 'OSHA 29 CFR 1910.147 - LOTO';
    const ragRetriever: RagRetriever = { retrieve: async () => ({ status: 'OK', evidence: [{ chunkId: 'c1', documentId: 'd1', content: 'Use isolation; raw chunk marker.', score: 0.8, sourceId: 'loto', title: 'LOTO', module: 'safety', version: '1', citationLabel: label, sourceOrganization: 'OSHA', jurisdiction: 'US', sourceUrl: 'https://osha.gov' }] }) };
    const model = createMockModel([{ toolCall: { name: 'search_hse_knowledge', input: '{"query":"LOTO"}' } }, { text: `Use isolation [${label}].` }]);
    await runHseAgent({ threadId: A, message: 'LOTO guidance', model, emit, threadStore: store, ragRetriever,toolFactory:createHermeticToolFactory({ragRetriever}) });
    const serialized = JSON.stringify(store.states.get(A));
    assert.match(serialized, /OSHA 29 CFR/); assert.doesNotMatch(serialized, /raw chunk|embedding|0\.8/);
  });

  test('secrets are not persisted', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'Normal HSE question', model: createMockModel([{ text: 'Normal answer' }]), emit, threadStore: store });
    assert.doesNotMatch(JSON.stringify(store.states.get(A)), /OPENAI_API_KEY|DATABASE_URL|system prompt/i);
    assert.equal(sanitizePersistedContent('DATABASE_URL=postgres://user:secret@host/db'), '[REDACTED_CREDENTIAL]');
  });

  test('invalid or conflicting thread IDs are rejected', async () => {
    await assert.rejects(() => runHseAgent({ threadId: '', message: 'x', model: createMockModel([{ text: 'x' }]), emit }), InvalidThreadIdError);
    await assert.rejects(() => runHseAgent({ threadId: A, conversationId: B, message: 'x', model: createMockModel([{ text: 'x' }]), emit }), InvalidThreadIdError);
  });

  test('failed model invocation leaves the previous state intact', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'valid HSE question', model: createMockModel([{ text: 'saved' }]), emit, threadStore: store });
    const before = JSON.stringify(store.states.get(A));
    const result = await runHseAgent({ threadId: A, message: 'failing HSE question', model: createMockModel([{ error: 'provider failed' }]), emit, threadStore: store });
    assert.equal(result.status, AgentStatus.FAILED); assert.equal(JSON.stringify(store.states.get(A)), before);
  });

  test('failed retrieval leaves the previous state intact', async () => {
    resetGraphCache(); const store = new MemoryThreadStore();
    await runHseAgent({ threadId: A, message: 'valid HSE question', model: createMockModel([{ text: 'saved' }]), emit, threadStore: store });
    const before = JSON.stringify(store.states.get(A));
    const ragRetriever: RagRetriever = { retrieve: async () => { throw new Error('retrieval failed'); } };
    const result = await runHseAgent({ threadId: A, message: 'LOTO guidance', model: createMockModel([{ toolCall: { name: 'search_hse_knowledge', input: '{"query":"LOTO"}' } }]), emit, threadStore: store, ragRetriever });
    assert.equal(result.status, AgentStatus.FAILED); assert.equal(JSON.stringify(store.states.get(A)), before);
  });

  test('reset deletes one thread only', async () => {
    const store = new MemoryThreadStore();
    await store.save({ threadId: A, userId: USER, messages: [], lastRagUsed: false, sourceReferences: [] });
    await store.save({ threadId: B, userId: USER, messages: [], lastRagUsed: false, sourceReferences: [] });
    await store.reset(A, USER); assert.equal(await store.load(A, USER), null); assert.ok(await store.load(B, USER));
  });

  test('a foreign user cannot load a known thread UUID', async () => {
    const store = new MemoryThreadStore();
    await store.save({ threadId: A, userId: USER, messages: [{ role:'user', content:'private' }], lastRagUsed:false, sourceReferences:[] });
    assert.ok(await store.load(A, USER));
    assert.equal(await store.load(A, '22222222-2222-4222-8222-222222222222'), null);
  });

  test('message history is deterministically bounded', () => {
    const messages = Array.from({ length: MAX_HISTORY_TURNS + 10 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: String(i) }));
    const reduced = minimizeThreadMessages(messages);
    assert.equal(reduced.length, MAX_HISTORY_TURNS); assert.equal(reduced[0].content, '10');
  });
});
