'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runDemoStartPreflight, startupBanner } = require('./start-safety');

function database(name, summary = {}) {
  return async () => ({
    query: async (sql) => {
      if (/current_database/i.test(sql)) return { rows: [{ name }] };
      if (/action_id FROM action_tracker/i.test(sql)) return { rows: [{ action_id: 'DEMO-ACT-001' }] };
      const key = /FROM\s+([a-z_]+)/i.exec(sql)?.[1];
      const counts = {
        projects: 3, action_tracker_capa: 12, incident_register: 5,
        permit_to_work_register: 4, hira_register: 4, jsa_log: 4,
        contractor_management: 3, audit_tracker: 3, document_control: 3,
        training_competency: 3, rag_documents: 4, rag_chunks: 4,
        agent_thread_state: 0, agent_long_term_memory: 0, agent_human_approval: 0,
      };
      if (/status='Active'.*project_type='Data Center'/i.test(sql)) return { rows: [{ count: 2 }] };
      if (/status <> 'Closed'/i.test(sql)) return { rows: [{ count: 8 }] };
      if (/NOT EXISTS/i.test(sql)) return { rows: [{ count: 0 }] };
      return { rows: [{ count: summary[key] ?? counts[key] ?? 0 }] };
    },
    end: async () => undefined,
  });
}

test('port free plus hse_app_demo passes preflight', async () => {
  const result = await runDemoStartPreflight({ targetUrl: 'safe', checkPort: async () => ({ available:true, pid:null }), connectDatabase: database('hse_app_demo') });
  assert.equal(result.ok, true);
});

test('occupied port is refused without starting or connecting', async () => {
  let connected = false;
  const result = await runDemoStartPreflight({ targetUrl: 'safe', checkPort: async () => ({ available:false, pid:4321 }), connectDatabase: async () => { connected=true; throw new Error('must not connect'); } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'PORT_OCCUPIED');
  assert.match(result.message, /DEMO START REFUSED/);
  assert.match(result.message, /PID: 4321/);
  assert.equal(connected, false);
});

test('hse_app database is refused', async () => {
  await assert.rejects(() => runDemoStartPreflight({ targetUrl:'unsafe', checkPort:async()=>({available:true,pid:null}), connectDatabase:database('hse_app') }), /DEMO START REFUSED/);
});

test('hse_app_demo database is verified and banner uses actual aggregates', async () => {
  const result = await runDemoStartPreflight({ targetUrl:'safe', checkPort:async()=>({available:true,pid:null}), connectDatabase:database('hse_app_demo') });
  assert.equal(result.ok, true);
  assert.equal(result.summary.projects, 3);
  assert.equal(result.summary.activeDataCenterProjects, 2);
  assert.equal(result.summary.actions, 12);
  assert.equal(result.summary.overdueActions, 8);
  assert.equal(result.message, startupBanner(result.summary));
  assert.match(result.message, /Demo database verified: YES/);
});
