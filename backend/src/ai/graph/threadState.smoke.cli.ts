import '../../config/env.bootstrap';
import { randomUUID } from 'node:crypto';
import { resolveModel } from '../providers';
import { runHseAgent } from './hseAgent.runner';
import { createProductionAiComposition } from '../productionDependencies';

const composition = createProductionAiComposition();
const { threadStateStore } = composition;
import { pool } from '../../db/pool';

async function turn(threadId: string, turnId: string, message: string) {
  const result = await runHseAgent({
    threadId, message, model: resolveModel('openai', 'gpt-5.1'), emit: () => undefined,
    threadStore: threadStateStore, toolFactory: composition.aiChatDependencies.toolFactory,
  });
  console.log(JSON.stringify({ turnId, status: result.status, threadRestored: (await threadStateStore.load(threadId)) !== null, ragUsed: result.ragUsed, sources: result.citations?.map((item) => item.sourceId) ?? [] }));
  return result;
}

async function main() {
  const configured = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim().length > 0;
  console.log(`OPENAI API CONFIGURED: ${configured ? 'YES' : 'NO'}`);
  if (!configured) throw new Error('OpenAI is not configured');
  const threadA = randomUUID(); const threadB = randomUUID();
  try {
    const a1 = await turn(threadA, 'A1', 'What precautions should be taken before performing lockout/tagout?');
    const a2 = await turn(threadA, 'A2', 'What about restoring energy afterward?');
    const b1 = await turn(threadB, 'B1', 'What should an emergency procedure define?');
    const a3 = await turn(threadA, 'A3', 'And who should verify the isolation?');
    const stateA = await threadStateStore.load(threadA); const stateB = await threadStateStore.load(threadB);
    const aSources = [a1, a2, a3].flatMap((item) => item.citations ?? []).map((item) => item.sourceId);
    const bSources = (b1.citations ?? []).map((item) => item.sourceId);
    console.log(JSON.stringify({ summary: 'thread-isolation', threadAStoredTurns: (stateA?.messages.length ?? 0) / 2, threadBStoredTurns: (stateB?.messages.length ?? 0) / 2, threadAHasLoto: aSources.some((id) => /loto/i.test(id)), threadBHasEmergency: bSources.some((id) => /emergency/i.test(id)), crossThreadCitationLeakage: bSources.some((id) => /loto/i.test(id)) }));
  } finally {
    await threadStateStore.reset(threadA); await threadStateStore.reset(threadB);
  }
}

main().catch((error) => { console.error(`Thread smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; }).finally(() => pool.end());
