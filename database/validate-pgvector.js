'use strict';

const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
const dimensions = Number(process.env.EMBEDDING_DIMENSIONS || 1536);
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
if (!Number.isInteger(dimensions) || dimensions <= 0) {
  console.error('EMBEDDING_DIMENSIONS must be a positive integer.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    const extension = await client.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
    if (extension.rowCount !== 1) throw new Error('pgvector extension is not enabled');

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
    `, [['rag_documents', 'rag_chunks']]);
    if (tables.rowCount !== 2) throw new Error('RAG tables are missing');

    const existing = await client.query(`
      SELECT count(*)::integer AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name NOT LIKE 'rag_%'
        AND table_name NOT IN ('schema_migrations', 'agent_thread_state', 'agent_long_term_memory', 'agent_human_approval')
    `);
    if (existing.rows[0].count < 1) throw new Error('existing HSE tables are not accessible');

    const hash = '0'.repeat(64);
    const document = await client.query(`
      INSERT INTO rag_documents (source_type, source_reference, module, title, content_hash)
      VALUES ('validation', 'rollback-only', 'validation', 'Validation document', $1)
      RETURNING id
    `, [hash]);
    const vector = `[${Array(dimensions).fill('0').join(',')}]`;
    await client.query(`
      INSERT INTO rag_chunks (document_id, chunk_index, content, token_count, embedding)
      VALUES ($1, 0, 'validation chunk', 2, $2::vector)
    `, [document.rows[0].id, vector]);

    await client.query('SAVEPOINT validate_foreign_key');
    try {
      await client.query(`
        INSERT INTO rag_chunks (document_id, chunk_index, content, embedding)
        VALUES (-1, 0, 'orphan validation chunk', $1::vector)
      `, [vector]);
      throw new Error('document_id foreign key accepted an orphan chunk');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT validate_foreign_key');
      if (!error || error.code !== '23503') throw error;
    }

    await client.query('ROLLBACK');
    console.log(JSON.stringify({
      status: 'PASS',
      pgvectorVersion: extension.rows[0].extversion,
      ragTables: tables.rows.map((row) => row.table_name).sort(),
      vectorDimensions: dimensions,
      existingTableCount: existing.rows[0].count,
      foreignKeyInsert: 'PASS',
      foreignKeyRejectsOrphan: 'PASS',
      validationWritesPersisted: false,
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Validation failed: ${error.message}`);
  process.exitCode = 1;
});
