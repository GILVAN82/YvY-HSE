import '../config/env.bootstrap';
import { pool } from '../db/pool';
import { ACTION_OVERDUE_SQL } from '../domain/actions';
import { ACTION_MODEL_VISIBLE_FIELDS } from './operationalDataProjection';
import { createProductionAiDependencies } from './productionDependencies';

void (async () => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM action_tracker_capa WHERE ${ACTION_OVERDUE_SQL}`
  );
  const tools = createProductionAiDependencies().toolFactory!(false);
  const toolResult = await (tools.list_actions as any).execute(
    { overdue: true, limit: 50 }, { toolCallId: 'local-egress-audit', messages: [] }
  );
  if (!toolResult || !Array.isArray(toolResult.data)) throw new Error('list_actions audit did not return operational rows');
  const expected = JSON.stringify([...ACTION_MODEL_VISIBLE_FIELDS]);
  if (!toolResult.data.every((row: Record<string, unknown>) => JSON.stringify(Object.keys(row)) === expected)) {
    throw new Error('list_actions projection does not match the reviewed allowlist');
  }
  console.log(`ROWS MATCHED: ${Number(result.rows[0]?.count ?? 0)}`);
  console.log('MODEL-VISIBLE FIELDS:');
  for (const field of ACTION_MODEL_VISIBLE_FIELDS) console.log(field);
  console.log('PERSONAL FIELDS EXCLUDED: YES');
  await pool.end();
})().catch(() => {
  console.log('EGRESS AUDIT: FAILED');
  process.exitCode = 1;
});
