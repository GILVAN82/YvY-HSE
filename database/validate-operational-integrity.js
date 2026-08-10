'use strict';

const { Client } = require('pg');

const excluded = ['schema_migrations', 'agent_thread_state', 'agent_long_term_memory', 'agent_human_approval'];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name NOT LIKE 'rag_%'
        AND table_name <> ALL($1::text[]) ORDER BY table_name
    `, [excluded]);
    let operationalRows = 0;
    for (const { table_name: table } of tables.rows) {
      const identifier = `"${table.replace(/"/g, '""')}"`;
      operationalRows += Number((await client.query(`SELECT count(*)::int AS count FROM ${identifier}`)).rows[0].count);
    }
    console.log(JSON.stringify({ status: 'PASS', hseTables: tables.rowCount, operationalRows }));
  } finally { await client.end(); }
}

main().catch(() => { console.log('OPERATIONAL INTEGRITY: FAIL'); process.exitCode = 1; });
