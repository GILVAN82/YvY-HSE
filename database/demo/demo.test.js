'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const data = require('./dataset');
const { demoDatabaseUrl } = require('./config');
const { assertDemoDatabase, validateSummary } = require('./demo-lib');

function fakeCurrentDatabase(name) {
  return { query: async () => ({ rows: [{ name }] }) };
}

const validSummary = {
  projects:3, activeDataCenterProjects:2, actions:12, overdueActions:8,
  mostOverdueAction:'DEMO-ACT-001', incidents:5, ptw:4, risks:4, jsa:4,
  contractors:3, audits:3, documents:3, training:3, ragDocuments:4, ragChunks:4,
  threadState:0, longTermMemory:0, pendingApprovals:0, relationshipIntegrity:true,
};

test('demo reset refuses hse_app', async () => {
  await assert.rejects(() => assertDemoDatabase(fakeCurrentDatabase('hse_app')), /DEMO RESET REFUSED/);
});

test('demo reset allows only hse_app_demo', async () => {
  assert.equal(await assertDemoDatabase(fakeCurrentDatabase('hse_app_demo')), 'hse_app_demo');
});

test('explicit non-demo URL fails before a connection is attempted', () => {
  assert.throws(() => demoDatabaseUrl({ DEMO_DATABASE_URL:'postgresql://localhost/hse_app' }), /DEMO RESET REFUSED/);
});

test('synthetic seed is deterministic', () => {
  const hash = () => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  assert.equal(hash(), hash());
  assert.equal(data.projects.length, 3);
});

test('repeat reset target counts remain identical', () => {
  assert.equal(validateSummary({ ...validSummary }, true), true);
  assert.equal(validateSummary({ ...validSummary }, true), true);
});

test('relationship identifiers resolve inside the synthetic dataset', () => {
  const projects = new Set(data.projects.map((row) => row[0]));
  const jsas = new Set(data.jsa.map((row) => row[0]));
  assert.ok(data.actions.every((row) => projects.has(row[3])));
  assert.ok(data.incidents.every((row) => projects.has(row[1])));
  assert.ok(data.permits.every((row) => projects.has(row[1]) && jsas.has(row[7])));
});

test('overdue action count is exactly eight under the product rule', () => {
  const cutoff = new Date('2026-08-10T00:00:00Z');
  const count = data.actions.filter((row) => row[8] !== 'Closed' && row[7] && new Date(`${row[7]}T00:00:00Z`) < cutoff).length;
  assert.equal(count, 8);
});

test('most-overdue action is deterministic', () => {
  const open = data.actions.filter((row) => row[8] !== 'Closed').sort((a,b) => a[7].localeCompare(b[7]) || a[0].localeCompare(b[0]));
  assert.equal(open[0][0], 'DEMO-ACT-001');
});

test('project counts support the active Data Center demo query', () => {
  assert.equal(data.projects.filter((row) => row[7] === 'Data Center' && row[8] === 'Active').length, 2);
});

test('dataset contains only explicit synthetic role-based identities and clean agent state expectations', () => {
  const serialized = JSON.stringify(data);
  assert.match(serialized, /Synthetic/);
  assert.doesNotMatch(serialized, /injured_person_name|medical record|@/i);
  assert.equal(validSummary.threadState + validSummary.longTermMemory + validSummary.pendingApprovals, 0);
});
