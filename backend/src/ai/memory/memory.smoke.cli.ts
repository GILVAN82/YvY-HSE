import '../../config/env.bootstrap';
import { randomUUID } from 'node:crypto';
import { resolveModel } from '../providers';
import { runHseAgent } from '../graph/hseAgent.runner';
import { threadStateStore } from '../graph/threadState.repository';
import { longTermMemoryService } from './memory.service';
import { pool } from '../../db/pool';

async function run(threadId: string, message: string) {
  return runHseAgent({ threadId, message, model: resolveModel('openai', 'gpt-5.1'), emit: () => undefined, threadStore: threadStateStore, memoryService: longTermMemoryService });
}

async function main() {
  const configured = !!process.env.OPENAI_API_KEY?.trim();
  console.log(`OPENAI API CONFIGURED: ${configured ? 'YES' : 'NO'}`);
  if (!configured) throw new Error('OpenAI is not configured');
  const a = randomUUID(); const b = randomUUID(); const c = randomUUID();
  const createdKeys: string[] = [];
  try {
    const save = await run(a, 'Remember that for this YVY HSE project PostgreSQL is the persistence database.');
    const found = await longTermMemoryService.retrieveRelevant('Which persistence database should this project use?');
    createdKeys.push(...found.map((memory) => memory.memoryKey));
    const read = await run(b, 'Which persistence database should this project use?');
    const crossThreadAvailable = found.some((memory) => /postgresql/i.test(memory.content));
    const answerUsesMemory = /postgresql/i.test(read.text);
    for (const key of createdKeys) await longTermMemoryService.forget(key);
    const afterForget = await longTermMemoryService.retrieveRelevant('Which persistence database should this project use?');
    const after = await run(c, 'Which persistence database should this project use?');
    console.log(JSON.stringify({ saveStatus: save.status, saveToolUsed: save.toolsUsed.includes('save_memory'), newThreadReadStatus: read.status, crossThreadMemoryAvailable: crossThreadAvailable, answerUsesPostgreSQL: answerUsesMemory, forgottenMemoryCount: createdKeys.length, memorySuppliedAfterForget: afterForget.length, postForgetThreadStatus: after.status }));
  } finally {
    for (const key of createdKeys) await longTermMemoryService.forget(key).catch(() => false);
    if (createdKeys.length) await pool.query('DELETE FROM agent_long_term_memory WHERE memory_key=ANY($1::text[])', [createdKeys]);
    await threadStateStore.reset(a); await threadStateStore.reset(b); await threadStateStore.reset(c);
  }
}

main().catch((error) => { console.error(`Memory smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; }).finally(() => pool.end());
