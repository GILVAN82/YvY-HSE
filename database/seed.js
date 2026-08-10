#!/usr/bin/env node
/**
 * Seed script — loads the initial dataset (data.json) into PostgreSQL,
 * following backend/src/config/tableMeta.json.
 *
 * Usage:
 *   node database/seed.js
 *
 * Requires DATABASE_URL env var (see backend/.env.example).
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const META = JSON.parse(fs.readFileSync(path.join(__dirname, '../backend/src/config/tableMeta.json'), 'utf8'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/hse_app' });

function toDbValue(v, type) {
  if (v === '' || v === null || v === undefined) return null;
  if (type === 'NUMERIC') {
    const n = Number(v);
    return isNaN(n) ? null : n;
  }
  if (type === 'DATE') {
    // data.json stores ISO 'YYYY-MM-DD' strings already, or ''
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? v : null;
  }
  return String(v);
}

async function seedProjects(client) {
  const rows = DATA['Project Register'].tables[0].rows;
  // headers: Project Code, Project Name, Client, Location/Site, Country/Region,
  // Project Manager, HSE Manager/Officer, Project Type, Status, Start Date,
  // Planned End Date, Actual End Date, ... Notes(last)
  let n = 0;
  for (const r of rows) {
    if (!r[0]) continue;
    await client.query(
      `INSERT INTO projects (code,name,client,location,country_region,project_manager,hse_manager,project_type,status,start_date,planned_end_date,actual_end_date,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (code) DO NOTHING`,
      [r[0], r[1]||r[0], r[2]||null, r[3]||null, r[4]||null, r[5]||null, r[6]||null, r[7]||null, r[8]||null,
       toDbValue(r[9],'DATE'), toDbValue(r[10],'DATE'), toDbValue(r[11],'DATE'), r[r.length-1]||null]
    );
    n++;
  }
  console.log(`  projects: ${n} rows`);
}

async function seedLists(client) {
  const L = DATA.Lists;
  let n = 0;
  for (const b of L.blocks) {
    for (const item of b.items) {
      if (!item) continue;
      await client.query(
        `INSERT INTO lookup_lists ("group", title, item) VALUES ($1,$2,$3)`,
        [b.group, b.title, item]
      );
      n++;
    }
  }
  for (const s of L.settings) {
    await client.query(
      `INSERT INTO settings (named_range, value, used_for) VALUES ($1,$2,$3)
       ON CONFLICT (named_range) DO UPDATE SET value=EXCLUDED.value, used_for=EXCLUDED.used_for`,
      [s[0], s[1]||null, s[2]||null]
    );
  }
  console.log(`  lookup_lists: ${n} rows, settings: ${L.settings.length} rows`);
}

async function seedGenericTables(client) {
  for (const [sheet, sheetMeta] of Object.entries(META)) {
    const sheetData = DATA[sheet];
    if (!sheetData) continue;
    for (let ti = 0; ti < sheetMeta.tables.length; ti++) {
      const tMeta = sheetMeta.tables[ti];
      const tData = sheetData.tables[ti];
      if (!tData) continue;
      const colNames = tMeta.columns.map(c => `"${c.name}"`).join(',');
      const placeholders = tMeta.columns.map((_, i) => `$${i + 1}`).join(',');
      let n = 0;
      for (const row of tData.rows) {
        const vals = tMeta.columns.map((c, i) => toDbValue(row[i], c.type));
        if (vals.every(v => v === null)) continue;
        await client.query(
          `INSERT INTO "${tMeta.db_table}" (${colNames}) VALUES (${placeholders})`,
          vals
        );
        n++;
      }
      console.log(`  ${tMeta.db_table}: ${n} rows`);
    }
  }
}

(async () => {
  const client = await pool.connect();
  try {
    console.log('Seeding projects...');
    await seedProjects(client);
    console.log('Seeding lists & settings...');
    await seedLists(client);
    console.log('Seeding data tables...');
    await seedGenericTables(client);
    console.log('Done.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
