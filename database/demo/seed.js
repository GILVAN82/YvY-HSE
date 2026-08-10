#!/usr/bin/env node
'use strict';

const { demoDatabaseUrl } = require('./config');
const { assertDemoDatabase, connect, readSummary, seedDemo, validateSummary } = require('./demo-lib');

async function main() {
  const client = await connect(demoDatabaseUrl());
  try {
    await assertDemoDatabase(client);
    const before = await readSummary(client);
    if (before.projects || before.actions || before.incidents) throw new Error('DEMO SEED REFUSED: demo operational tables are not empty; use demo:reset');
    await seedDemo(client);
    const summary = await readSummary(client);
    if (!validateSummary(summary, false)) throw new Error('DEMO SEED VALIDATION FAILED');
    console.log(`DEMO SEED READY: projects=${summary.projects}, actions=${summary.actions}, overdue=${summary.overdueActions}, incidents=${summary.incidents}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
