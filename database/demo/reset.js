#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { BACKEND_DIR, DEMO_DATABASE_NAME, adminDatabaseUrl, demoDatabaseUrl } = require('./config');
const { applySchemaAndMigrations, assertDemoDatabase, connect, readSummary, seedDemo, validateSummary } = require('./demo-lib');

function printSummary(summary) {
  console.log('\nDEMO DATABASE READY');
  console.log(`Database: ${summary.database}`);
  console.log(`Projects: ${summary.projects}`);
  console.log(`Active Data Center Projects: ${summary.activeDataCenterProjects}`);
  console.log(`Actions: ${summary.actions}`);
  console.log(`Overdue Actions: ${summary.overdueActions}`);
  console.log(`Most Overdue Action: ${summary.mostOverdueAction}`);
  console.log(`Incidents: ${summary.incidents}`);
  console.log(`PTWs: ${summary.ptw}`);
  console.log(`Risk Records: ${summary.risks}`);
  console.log(`RAG Documents: ${summary.ragDocuments}`);
  console.log(`RAG Chunks: ${summary.ragChunks}`);
  console.log(`Relationship Integrity: ${summary.relationshipIntegrity ? 'PASS' : 'FAIL'}`);
  console.log(`Agent State Clean: ${summary.threadState + summary.longTermMemory + summary.pendingApprovals === 0 ? 'PASS' : 'FAIL'}`);
}

async function ensureDatabase(targetUrl) {
  const admin = new Client({ connectionString: adminDatabaseUrl(targetUrl) });
  await admin.connect();
  try {
    const current = (await admin.query('SELECT current_database() AS name')).rows[0]?.name;
    if (current !== 'postgres') throw new Error('DEMO RESET REFUSED: administrative connection is not postgres');
    const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [DEMO_DATABASE_NAME])).rowCount > 0;
    if (!exists) await admin.query('CREATE DATABASE "hse_app_demo"');
  } finally {
    await admin.end();
  }
}

async function main() {
  const targetUrl = demoDatabaseUrl();
  await ensureDatabase(targetUrl);
  const client = await connect(targetUrl);
  try {
    await assertDemoDatabase(client);
    // Destructive by design, but only after the exact current_database guard above.
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await applySchemaAndMigrations(client);
    await seedDemo(client);
  } finally {
    await client.end();
  }

  const ingestRag = process.env.DEMO_SKIP_RAG !== '1';
  if (ingestRag) {
    const result = spawnSync(process.execPath, ['--require', 'ts-node/register/transpile-only', 'src/ai/rag/ingest.cli.ts'], {
      cwd: BACKEND_DIR,
      env: { ...process.env, DATABASE_URL: targetUrl },
      encoding: 'utf8',
      stdio: 'inherit',
    });
    if (result.error) throw new Error(`Demo RAG ingestion could not start: ${result.error.message}`);
    if (result.status !== 0) throw new Error('Demo RAG ingestion failed');
  }

  const validationClient = await connect(targetUrl);
  try {
    const summary = await readSummary(validationClient);
    printSummary(summary);
    if (!validateSummary(summary, ingestRag)) throw new Error('DEMO VALIDATION FAILED');
  } finally {
    await validationClient.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
