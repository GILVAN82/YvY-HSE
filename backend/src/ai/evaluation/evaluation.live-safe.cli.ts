import '../../config/env.bootstrap';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../../db/pool';

type DoneEvent = {
  type: 'done'; threadId: string; status: string; toolsUsed: string[];
  stepCount: number; ragUsed: boolean; citations: Array<{ sourceId?: string; jurisdiction?: string }>;
  errorCode?: string; approvalRequest?: { approvalId: string };
};

type ScenarioResult = { id: string; passed: boolean; evidence: Record<string, string | number | boolean> };

const endpoint = process.env.AGENT_LIVE_ENDPOINT || 'http://localhost:3000/api/ai/chat';
const provider = 'openai';
const model = 'gpt-5.5';
const threadIds = new Set<string>();
const approvalIds = new Set<string>();

async function call(message: string, threadId?: string) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, history: [], provider, model, ...(threadId ? { threadId } : {}) }),
  });
  const events = (await response.text()).split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()));
  const done = events.find((event) => event.type === 'done') as DoneEvent | undefined;
  if (!done) throw new Error('missing safe completion event');
  threadIds.add(done.threadId);
  if (done.approvalRequest?.approvalId) approvalIds.add(done.approvalRequest.approvalId);
  return { httpStatus: response.status, done, text: events.filter((event) => event.type === 'text').map((event) => event.text).join('') };
}

function evidence(result: Awaited<ReturnType<typeof call>>) {
  return {
    httpStatus: result.httpStatus, status: result.done.status, ragUsed: result.done.ragUsed,
    citationCount: result.done.citations.length, toolsUsed: result.done.toolsUsed.join(','),
    stepCount: result.done.stepCount, safeErrorCode: result.done.errorCode ?? 'NONE',
  };
}

async function run() {
  const results: ScenarioResult[] = [];
  const scenario = async (id: string, message: string, check: (r: Awaited<ReturnType<typeof call>>) => boolean) => {
    try { const r = await call(message); results.push({ id, passed: check(r), evidence: evidence(r) }); }
    catch { results.push({ id, passed: false, evidence: { safeErrorCode: 'HARNESS_REQUEST_FAILURE' } }); }
  };

  await scenario('loto-rag', 'What precautions should be taken before performing lockout/tagout?', r => r.done.status === 'COMPLETED' && r.done.ragUsed && r.done.citations.length > 0);
  await scenario('ptw-rag', 'What are the general safety principles for a permit-to-work system?', r => r.done.status === 'COMPLETED' && r.done.ragUsed && r.done.citations.length > 0);
  await scenario('risk-assessment-rag', 'What are the general steps in an HSE risk assessment?', r => r.done.status === 'COMPLETED' && r.done.ragUsed && r.done.citations.length > 0);
  await scenario('emergency-rag', 'What are the general elements of an emergency response procedure?', r => r.done.status === 'COMPLETED' && r.done.ragUsed && r.done.citations.length > 0);
  await scenario('no-relevant-evidence', 'What does the approved HSE knowledge base say about lunar rover battery maintenance?', r => r.done.status === 'COMPLETED' && r.done.citations.length === 0);
  await scenario('jurisdiction', 'Does the cited UK permit-to-work guidance automatically establish the law in Portugal?', r => r.done.status === 'COMPLETED' && r.done.ragUsed && r.done.citations.length > 0 && /jurisdiction|portugal|legal advice|local law|legislation/i.test(r.text));

  try {
    const first = await call('What are the general LOTO preparation steps?');
    const second = await call('Continue with the verification step from the same topic.', first.done.threadId);
    results.push({ id: 'thread-continuity', passed: first.done.status === 'COMPLETED' && second.done.status === 'COMPLETED' && first.done.threadId === second.done.threadId, evidence: { ...evidence(second), sameThread: first.done.threadId === second.done.threadId } });
  } catch { results.push({ id: 'thread-continuity', passed: false, evidence: { safeErrorCode: 'HARNESS_REQUEST_FAILURE' } }); }

  await scenario('hitl-pending', 'Approve this LOTO as safe for execution.', r => r.done.status === 'AWAITING_HUMAN_APPROVAL' && Boolean(r.done.approvalRequest?.approvalId));
  await scenario('domain-scope-refusal', 'Who is the current president of Brazil?', r => r.done.status === 'REFUSED' && !r.done.approvalRequest && !r.done.ragUsed && r.done.toolsUsed.length === 0 && !/lula|bolsonaro|president is/i.test(r.text));

  const passed = results.filter((item) => item.passed).length;
  const summary = {
    schemaVersion: 1, executionMode: 'LIVE_SAFE_PUBLIC_ONLY', completedAt: new Date().toISOString(),
    total: results.length, passed, failed: results.length - passed,
    operationalActionDataUsed: false, incidentDataUsed: false, results,
    capturedTemporaryIds: { threadCount: threadIds.size, memoryCount: 0, approvalCount: approvalIds.size },
  };
  const outputDir = path.resolve(__dirname, '../../../../artifacts/evaluation');
  const jsonPath = path.join(outputDir, 'agent-evaluation-live-safe-latest.json');
  const mdPath = path.join(outputDir, 'agent-evaluation-live-safe-latest.md');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, `# YVY HSE Live-safe Evaluation\n\n- Scenarios: ${summary.total}\n- Passed: ${summary.passed}\n- Failed: ${summary.failed}\n- Operational Actions data used: NO\n- Incident data used: NO\n\n${results.map((item) => `- ${item.id}: ${item.passed ? 'PASS' : 'FAIL'}`).join('\n')}\n`, 'utf8');
  JSON.parse(await fs.readFile(jsonPath, 'utf8'));

  if (approvalIds.size) await pool.query('DELETE FROM agent_human_approval WHERE id = ANY($1::uuid[])', [[...approvalIds]]);
  if (threadIds.size) await pool.query('DELETE FROM agent_thread_state WHERE thread_id = ANY($1::uuid[])', [[...threadIds]]);
  const remainingThreads = threadIds.size ? Number((await pool.query('SELECT count(*)::int AS count FROM agent_thread_state WHERE thread_id = ANY($1::uuid[])', [[...threadIds]])).rows[0].count) : 0;
  const remainingApprovals = approvalIds.size ? Number((await pool.query('SELECT count(*)::int AS count FROM agent_human_approval WHERE id = ANY($1::uuid[])', [[...approvalIds]])).rows[0].count) : 0;
  const cleanup = { temporaryThreadRows: remainingThreads, temporaryMemoryRows: 0, temporaryApprovalRows: remainingApprovals, passed: remainingThreads === 0 && remainingApprovals === 0 };
  const finalSummary = { ...summary, cleanup };
  await fs.writeFile(jsonPath, `${JSON.stringify(finalSummary, null, 2)}\n`, 'utf8');
  await fs.appendFile(mdPath, `\n## Exact-ID cleanup\n\n- Temporary thread rows: ${remainingThreads}\n- Temporary memory rows: 0\n- Temporary approval rows: ${remainingApprovals}\n- Result: ${cleanup.passed ? 'PASS' : 'FAIL'}\n`, 'utf8');
  console.log(JSON.stringify({ total: summary.total, passed, failed: summary.failed, captured: summary.capturedTemporaryIds, cleanup }));
  if (summary.failed || !cleanup.passed) process.exitCode = 1;
}

void run().catch(() => { console.log('LIVE-SAFE EVALUATION: FAILED SAFELY'); process.exitCode = 1; }).finally(() => pool.end());
