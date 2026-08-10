#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { BACKEND_DIR, demoDatabaseUrl } = require('./config');
const { runDemoStartPreflight } = require('./start-safety');

async function main() {
  const targetUrl = demoDatabaseUrl();
  const preflight = await runDemoStartPreflight({ targetUrl });
  if (!preflight.ok) {
    console.error(preflight.message);
    process.exitCode = 1;
    return;
  }

  console.log(preflight.message);
  if (process.env.DEMO_PREFLIGHT_ONLY === '1') return;
  const tsNodeDev = path.join(BACKEND_DIR, 'node_modules', 'ts-node-dev', 'lib', 'bin.js');
  const result = spawnSync(process.execPath, [tsNodeDev, '--respawn', '--transpile-only', 'src/index.ts'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: targetUrl },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
