/** Opt-in PostgreSQL regression, restricted to the disposable submission server. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, type Pool } from 'pg';
import { ControlledMemoryService } from './memory.service';
import { PostgresMemoryRepository } from './memory.repository';

async function main() {
  const url = new URL(process.env.MEMORY_VALIDATION_DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55432');
  assert.equal(url.pathname, '/hse_app_demo');
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query('BEGIN');
    const a = randomUUID(), b = randomUUID();
    for (const id of [a,b]) await db.query(
      'INSERT INTO app_user(id,email,display_name,password_hash,role) VALUES($1,$2,$3,$4,$5)',
      [id,`${id}@example.invalid`,'Memory isolation fixture','NOT_A_LOGIN_HASH','HSE_USER']);
    const repository = new PostgresMemoryRepository(db as unknown as Pool);
    const first = new ControlledMemoryService(repository,a), second = new ControlledMemoryService(repository,b);
    const candidate = {memoryKey:'review.format',category:'WORKFLOW_PREFERENCE' as const,content:'Use concise bullet points for audit summaries.'};
    assert.equal((await first.save(candidate)).status,'CREATED');
    assert.equal((await second.save(candidate)).status,'CREATED');
    assert.equal((await first.save({...candidate,memoryKey:'review.same-content'})).status,'UNCHANGED');
    assert.equal(await repository.countActive(a),1);
    assert.equal(await repository.countActive(b),1);
    assert.equal((await first.save({...candidate,content:'Use numbered audit summaries.'})).status,'CONFLICT');
    assert.equal(await first.forget(candidate.memoryKey),true);
    assert.equal(await repository.countActive(a),0);
    assert.equal(await repository.countActive(b),1);
    assert.equal((await first.save({...candidate,update:true})).status,'UPDATED');
    const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE tablename='agent_long_term_memory'");
    assert.ok(indexes.rows.some(row=>row.indexname==='agent_memory_user_content_hash_idx'));
    assert.ok(!indexes.rows.some(row=>row.indexname==='agent_long_term_memory_active_hash_idx'));
    console.log(JSON.stringify({result:'PASS',sameContentAcrossUsers:true,sameUserDuplicate:'UNCHANGED',keyConflict:'CONFLICT',forgetIsolated:true,reactivation:'UPDATED',persistentWrites:0}));
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
}
void main().catch(error=>{console.error('Memory isolation validation failed:',error instanceof Error?error.name:'unknown');process.exitCode=1;});
