import { capturedContext, capturedSystem } from '../../ai/__tests__/mockModel';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { tool } from 'ai';
import { z } from 'zod';
import { createAiChatRouter } from '../aiChat';
import { createMockModel } from '../../ai/__tests__/mockModel';
import { runHseAgent, resetGraphCache } from '../../ai/graph/hseAgent.runner';
import { runLegacyAgent } from '../../ai/legacyRunner';
import { temporaryAttachmentService } from '../../ai/attachments/attachment.service';
import type { PersistedThreadState, ThreadStateStore } from '../../ai/graph/threadState.repository';
import { createHseTools } from '../../ai/tools';
import { ApprovalResolutionError } from '../../ai/hitl/hitl.repository';
import type { ApprovalRequest, HumanDecision } from '../../ai/hitl/hitl.types';
import { randomUUID } from 'node:crypto';

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

async function start(model:any,tools?:any,approvals:any=approvalService,principal:any={userId:'11111111-1111-4111-8111-111111111111',email:'test@example.invalid',displayName:'Test User',role:'ADMIN',permissions:['HSE_DATA_READ','PROJECT_READ','AI_USE','MEMORY_USE','HITL_APPROVE','ADMIN_ACCESS'],allowedProjectIds:[]}) {
  resetGraphCache();
  const store = new MemoryThreadStore();
  const app = express();
  app.use(express.json());
  app.use((req:any,_res,next)=>{req.principal=principal;next();});
  app.use('/api', createAiChatRouter({
    resolveModel: () => model,
    readOrchestrator: () => 'langgraph',
    runHseAgent,
    runLegacyAgent,
    threadStateStore: store,
    longTermMemoryService: memoryService,
    humanApprovalService: approvals,
    attachmentService: temporaryAttachmentService,
    ...(tools ? { tools } : {}),
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return { port: address.port, store };
}

async function postJson(port: number, path: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, (res) => {
      let data = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }));
    });
    request.on('error', reject); request.end(body);
  });
}

class HttpApprovalService {
  approvals = new Map<string, ApprovalRequest>();
  lastResolvedBy: string | undefined;
  async create(threadId: string): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = { approvalId: randomUUID(), threadId, actionType: 'LOTO_SAFETY_EXECUTION', summary: 'LOTO approval', reason: 'Human decision required', riskLevel: 'CRITICAL', status: 'PENDING', requestedAt: new Date().toISOString() };
    this.approvals.set(approval.approvalId, approval); return approval;
  }
  async resolve(approvalId:string,threadId:string,decision:HumanDecision,note?:string,resolvedByUserId?:string):Promise<ApprovalRequest> {
    this.lastResolvedBy=resolvedByUserId;
    const current = this.approvals.get(approvalId);
    if (!current || current.threadId !== threadId || current.status !== 'PENDING') throw new ApprovalResolutionError('not pending');
    const resolved = { ...current, status: decision === 'APPROVE' ? 'APPROVED' as const : 'REJECTED' as const, resolvedAt: new Date().toISOString(), ...(note ? { resolutionNote: note } : {}) };
    this.approvals.set(approvalId, resolved); return resolved;
  }
  async get(id: string) { return this.approvals.get(id) ?? null; }
  async deleteForTest(id: string) { this.approvals.delete(id); }
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
    assert.equal(firstDone.responseStatus, 'SUCCESS');
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
    assert.equal(done.responseStatus, 'SUCCESS');
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
    const tools = createHseTools(database as any, async () => ({}), { retrieve: async () => ({ status: 'NO_RELEVANT_EVIDENCE', evidence: [] }) });
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
    const { port } = await start(model, createHseTools(database as any, async () => ({}), { retrieve: async () => ({ status: 'NO_RELEVANT_EVIDENCE', evidence: [] }) }));
    const events = await post(port, { message: 'Quais ações estão atrasadas?', history: [], provider: 'openai', model: 'gpt-5.5' });
    assert.equal(events.find((event) => event.type === 'done')?.status, 'COMPLETED');
    assert.deepEqual(calls[0].params, [20]);
    assert.doesNotMatch(calls[0].sql, /project = \$|status = \$/);
  });
});

describe('POST /api/ai/approvals HTTP boundary', () => {
  const threadId = '11111111-2222-4333-8444-555555555555';

  test('persists PENDING -> APPROVED and rejects duplicate resolution', async () => {
    const approvals = new HttpApprovalService(); const pending = await approvals.create(threadId);
    const { port } = await start(createMockModel([{ text: 'unused' }]), undefined, approvals);
    const first = await postJson(port, `/api/ai/approvals/${pending.approvalId}/approve`, { threadId, resolutionNote: 'Demo approval.' });
    assert.equal(first.status, 200); assert.equal(first.body.approval.status, 'APPROVED'); assert.equal(first.body.responseStatus, 'APPROVED'); assert.ok(first.body.approval.resolvedAt);
    assert.match(first.body.text, /Field verification by competent personnel/); assert.doesNotMatch(first.body.text, /equipment is safe/i);
    const duplicate = await postJson(port, `/api/ai/approvals/${pending.approvalId}/approve`, { threadId });
    assert.equal(duplicate.status, 409); assert.equal(duplicate.body.code, 'AI_APPROVAL_NOT_PENDING');
  });

  test('identity fields supplied in the chat body are ignored in favor of RequestPrincipal',async()=>{
    const model=createMockModel([{text:'HSE assistance is available.'}]);const {port}=await start(model);
    const response=await post(port,{message:'HSE help',history:[],provider:'openai',model:'gpt-5.5',firstName:'Spoofed',displayName:'Spoofed User'});
    assert.ok(response.some(event=>event.type==='done'));const input=JSON.stringify(model.callInputs()[0]);assert.equal(capturedContext(model).identity.firstName,'Test');assert.doesNotMatch(capturedSystem(model), /Trusted first name/);assert.doesNotMatch(input,/Spoofed/);
  });

  test('persists rejection and keeps the critical action blocked', async () => {
    const approvals = new HttpApprovalService(); const pending = await approvals.create(threadId);
    const { port } = await start(createMockModel([{ text: 'unused' }]), undefined, approvals);
    const result = await postJson(port, `/api/ai/approvals/${pending.approvalId}/reject`, { threadId });
    assert.equal(result.status, 200); assert.equal(result.body.approval.status, 'REJECTED'); assert.equal(result.body.responseStatus, 'REJECTED'); assert.ok(result.body.approval.resolvedAt);
    assert.match(result.body.text, /remains blocked and must not proceed/);
  });

  test('ordinary users receive 403 while approver identity comes only from RequestPrincipal',async()=>{
    const approvals=new HttpApprovalService();const pending=await approvals.create(threadId);
    const ordinary={userId:'22222222-2222-4222-8222-222222222222',email:'user@example.invalid',displayName:'User',role:'HSE_USER',permissions:['AI_USE','MEMORY_USE','HSE_DATA_READ','PROJECT_READ'],allowedProjectIds:['PRJ-001']};
    const {port}=await start(createMockModel([{text:'unused'}]),undefined,approvals,ordinary);
    const denied=await postJson(port,`/api/ai/approvals/${pending.approvalId}/approve`,{threadId,userId:'spoofed-admin'});assert.equal(denied.status,403);assert.equal(approvals.lastResolvedBy,undefined);
    const approver={...ordinary,userId:'33333333-3333-4333-8333-333333333333',role:'APPROVER',permissions:[...ordinary.permissions,'HITL_APPROVE']};
    const second=await start(createMockModel([{text:'unused'}]),undefined,approvals,approver);const allowed=await postJson(second.port,`/api/ai/approvals/${pending.approvalId}/approve`,{threadId,userId:'spoofed-admin'});assert.equal(allowed.status,200);assert.equal(approvals.lastResolvedBy,approver.userId);
  });

  test('rejects wrong thread, missing approval and invalid identifiers safely', async () => {
    const approvals = new HttpApprovalService(); const pending = await approvals.create(threadId);
    const { port } = await start(createMockModel([{ text: 'unused' }]), undefined, approvals);
    const wrongThread = await postJson(port, `/api/ai/approvals/${pending.approvalId}/approve`, { threadId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    assert.equal(wrongThread.status, 409); assert.equal((await approvals.get(pending.approvalId))?.status, 'PENDING');
    const missing = await postJson(port, `/api/ai/approvals/${randomUUID()}/reject`, { threadId });
    assert.equal(missing.status, 409); assert.equal(missing.body.code, 'AI_APPROVAL_NOT_PENDING');
    const invalid = await postJson(port, '/api/ai/approvals/not-a-uuid/approve', { threadId });
    assert.equal(invalid.status, 400); assert.equal(invalid.body.code, 'AI_INVALID_APPROVAL_REQUEST');
  });
});
