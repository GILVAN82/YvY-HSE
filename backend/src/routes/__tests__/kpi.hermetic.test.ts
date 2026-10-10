import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('KPI reusable and router modules import without database or provider configuration', () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === 'DATABASE_URL' || key.endsWith('_API_KEY') || key.includes('GOOGLE') || key.includes('PROVIDER')) delete env[key];
  }
  const result = spawnSync(
    process.execPath,
    ['--require', 'ts-node/register/transpile-only', '-e', "require('./src/routes/kpi.service'); require('./src/routes/kpi')"],
    { cwd: path.resolve(__dirname, '../../..'), env, encoding: 'utf8' }
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
