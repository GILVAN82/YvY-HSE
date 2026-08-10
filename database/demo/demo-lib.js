'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const data = require('./dataset');
const { DEMO_DATABASE_NAME } = require('./config');

const columns = {
  projects: ['code','name','client','location','country_region','project_manager','hse_manager','project_type','status','start_date','planned_end_date','actual_end_date','notes'],
  manpower_log: ['date','project_code','contractorcompany','tradediscipline','number_of_workers','hours_per_worker','total_manhours','month','cumulative_manhours_project'],
  incident_register: ['incident_id','project_code','date_of_incident','time','locationarea','incident_type','severity','description','injured_person_name','employeecontractor','departmenttrade','body_part_affected','immediate_cause','investigation_status','linked_investigation_id','linked_action_ids','lost_days','medical_treatment_required','reportable_to_authority','days_open','closed_date'],
  action_tracker_capa: ['action_id','source_module','source_reference','project','action_description','responsible_person','priority','target_date','status','computed_status','days_remainingoverdue','closure_date','verified_by','evidence_of_closure','comments'],
  jsa_log: ['jsa_id','project','taskactivity','date','prepared_by','approved_by','number_of_steps','permit_required','linked_permit_no','crew_briefed','briefing_date','revision_number','valid_until','status'],
  permit_to_work_register: ['permit_no','project','permit_type','work_description','location','requested_by','issued_by_authorized_person','linked_jsa_id','isolationloto_reference','gas_test_required','gas_test_reading','issue_datetime','valid_from','valid_to','status','closed_by','closed_date','remarks'],
  hira_register: ['hira_id','project','activitytask','location','date_assessed','assessed_by','hazard_description','hazard_category','existing_controls','likelihood','consequence','risk_rating','risk_level','additional_controls_required','residual_likelihood','residual_consequence','residual_risk_rating','residual_risk_level','action_owner','review_date','status'],
};

async function assertDemoDatabase(client) {
  const result = await client.query('SELECT current_database() AS name');
  const actual = result.rows[0]?.name;
  if (actual !== DEMO_DATABASE_NAME) throw new Error(`DEMO RESET REFUSED: connected to ${actual || 'unknown database'}`);
  return actual;
}

async function insertRows(client, table, names, rows) {
  const quoted = names.map((name) => `"${name}"`).join(',');
  const params = names.map((_, index) => `$${index + 1}`).join(',');
  for (const row of rows) await client.query(`INSERT INTO "${table}" (${quoted}) VALUES (${params})`, row);
}

async function applySchemaAndMigrations(client) {
  await assertDemoDatabase(client);
  const databaseDir = path.resolve(__dirname, '..');
  await client.query(fs.readFileSync(path.join(databaseDir, 'schema.sql'), 'utf8'));
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  for (const name of fs.readdirSync(path.join(databaseDir, 'migrations')).filter((item) => item.endsWith('.sql')).sort()) {
    await client.query(fs.readFileSync(path.join(databaseDir, 'migrations', name), 'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1) ON CONFLICT DO NOTHING', [name]);
  }
}

async function seedDemo(client) {
  await assertDemoDatabase(client);
  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO settings(named_range,value,used_for) VALUES ('RateBase','1000000','TRIR and LTIFR calculation') ON CONFLICT(named_range) DO UPDATE SET value=EXCLUDED.value, used_for=EXCLUDED.used_for`);
    await insertRows(client, 'projects', columns.projects, data.projects);
    await insertRows(client, 'manpower_log', columns.manpower_log, data.manpower);
    await insertRows(client, 'incident_register', columns.incident_register, data.incidents);
    await insertRows(client, 'action_tracker_capa', columns.action_tracker_capa, data.actions);
    await insertRows(client, 'jsa_log', columns.jsa_log, data.jsa);
    await insertRows(client, 'permit_to_work_register', columns.permit_to_work_register, data.permits);
    await insertRows(client, 'hira_register', columns.hira_register, data.hira);

    await insertRows(client, 'training_competency', ['training_id','project','employee_name','employee_id','traderole','coursetraining_name','training_provider','date_completed','certificate_no','validity_months','expiry_date','status','trainer','scoreresult'], [
      ['DEMO-TRN-001','DEMO-LIS-01','Electrical Supervisor','DEMO-ROLE-01','Electrical Supervisor','LOTO Verification','Synthetic Training Provider','2026-01-15','DEMO-CERT-001','12','2027-01-15','Valid','HSE Coordinator',95],
      ['DEMO-TRN-002','DEMO-MAD-02','Site Manager','DEMO-ROLE-02','Site Manager','PTW Authorization','Synthetic Training Provider','2026-02-15','DEMO-CERT-002','12','2027-02-15','Valid','HSE Coordinator',92],
      ['DEMO-TRN-003','DEMO-DUB-03','Design Manager','DEMO-ROLE-03','Design Manager','Design Risk Review','Synthetic Training Provider','2025-01-10','DEMO-CERT-003','12','2026-01-10','Expired','HSE Coordinator',88],
    ]);
    await insertRows(client, 'contractor_management', ['contractor_id','contractor_name','projects','hse_policy_on_file','prequalification_score','approved','approval_date','reviewexpiry_date','status','manhours_this_month','incidents_this_contractor','observations_this_contractor','overall_rating'], [
      ['DEMO-CON-001','Synthetic Electrical Contractor','DEMO-LIS-01','Yes',92,'Yes','2026-01-02','2027-01-02','Approved',100000,'1','4','Good'],
      ['DEMO-CON-002','Synthetic Civil Contractor','DEMO-MAD-02','Yes',84,'Conditional','2026-02-01','2026-10-01','Conditional',80000,'2','3','Satisfactory'],
      ['DEMO-CON-003','Synthetic Planning Partner','DEMO-DUB-03','Yes',95,'Yes','2026-03-01','2027-03-01','Approved',120000,'1','2','Good'],
    ]);
    await insertRows(client, 'audit_tracker', ['audit_id','project','audit_type','audit_date','auditors','scope','standardreference','number_of_findings','overall_audit_score','next_audit_due'], [
      ['DEMO-AUD-001','DEMO-LIS-01','Internal','2026-03-01','HSE Auditor Role','Electrical controls','ISO 45001 synthetic review',2,88,'2026-09-01'],
      ['DEMO-AUD-002','DEMO-MAD-02','Internal','2026-04-01','HSE Auditor Role','PTW controls','ISO 45001 synthetic review',1,92,'2026-10-01'],
      ['DEMO-AUD-003','DEMO-DUB-03','Design Review','2026-07-01','HSE Auditor Role','Design risk','ISO 45001 synthetic review',0,96,'2027-01-01'],
    ]);
    await insertRows(client, 'document_control', ['document_id','document_name','category','applicability','version_no','prepared_by','reviewed_by','approved_by','issue_date','review_frequency_months','next_review_due','status','file_locationlink'], [
      ['DEMO-DOC-001','Synthetic LOTO Verification Plan','Procedure','DEMO-LIS-01','1.0','Electrical Supervisor','HSE Coordinator','Site Manager','2026-01-05','12','2027-01-05','Approved','demo://documents/loto-plan'],
      ['DEMO-DOC-002','Synthetic PTW Coordination Plan','Procedure','DEMO-MAD-02','1.0','HSE Coordinator','Site Manager','Project Manager','2026-02-05','12','2027-02-05','Approved','demo://documents/ptw-plan'],
      ['DEMO-DOC-003','Synthetic Design Risk Plan','Plan','DEMO-DUB-03','0.2','Design Manager','HSE Coordinator',null,'2026-07-05','6','2027-01-05','Draft','demo://documents/design-risk'],
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function readSummary(client) {
  await assertDemoDatabase(client);
  const q = async (sql, values=[]) => Number((await client.query(sql, values)).rows[0].count);
  const most = (await client.query(`SELECT action_id FROM action_tracker_capa WHERE status <> 'Closed' AND target_date IS NOT NULL AND target_date < CURRENT_TIMESTAMP ORDER BY target_date ASC, action_id ASC LIMIT 1`)).rows[0]?.action_id || null;
  const orphanCounts = [];
  orphanCounts.push(await q(`SELECT count(*) FROM incident_register i WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.code=i.project_code)`));
  orphanCounts.push(await q(`SELECT count(*) FROM action_tracker_capa a WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.code=a.project)`));
  orphanCounts.push(await q(`SELECT count(*) FROM permit_to_work_register p WHERE NOT EXISTS (SELECT 1 FROM projects x WHERE x.code=p.project)`));
  orphanCounts.push(await q(`SELECT count(*) FROM permit_to_work_register p WHERE p.linked_jsa_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsa_log j WHERE j.jsa_id=p.linked_jsa_id)`));
  return {
    database: DEMO_DATABASE_NAME,
    projects: await q('SELECT count(*) FROM projects'),
    activeDataCenterProjects: await q(`SELECT count(*) FROM projects WHERE status='Active' AND project_type='Data Center'`),
    actions: await q('SELECT count(*) FROM action_tracker_capa'),
    overdueActions: await q(`SELECT count(*) FROM action_tracker_capa WHERE status <> 'Closed' AND target_date IS NOT NULL AND target_date < CURRENT_TIMESTAMP`),
    mostOverdueAction: most,
    incidents: await q('SELECT count(*) FROM incident_register'),
    ptw: await q('SELECT count(*) FROM permit_to_work_register'),
    risks: await q('SELECT count(*) FROM hira_register'),
    jsa: await q('SELECT count(*) FROM jsa_log'),
    contractors: await q('SELECT count(*) FROM contractor_management'),
    audits: await q('SELECT count(*) FROM audit_tracker'),
    documents: await q('SELECT count(*) FROM document_control'),
    training: await q('SELECT count(*) FROM training_competency'),
    ragDocuments: await q('SELECT count(*) FROM rag_documents'),
    ragChunks: await q('SELECT count(*) FROM rag_chunks'),
    threadState: await q('SELECT count(*) FROM agent_thread_state'),
    longTermMemory: await q('SELECT count(*) FROM agent_long_term_memory'),
    pendingApprovals: await q(`SELECT count(*) FROM agent_human_approval WHERE status='PENDING'`),
    relationshipIntegrity: orphanCounts.every((count) => count === 0),
  };
}

function validateSummary(summary, requireRag = true) {
  const expected = { projects:3, activeDataCenterProjects:2, actions:12, overdueActions:8, incidents:5, ptw:4, risks:4, jsa:4, contractors:3, audits:3, documents:3, training:3 };
  const countsPass = Object.entries(expected).every(([key,value]) => summary[key] === value);
  const ragPass = !requireRag || (summary.ragDocuments === 4 && summary.ragChunks === 4);
  return countsPass && ragPass && summary.mostOverdueAction === 'DEMO-ACT-001' && summary.relationshipIntegrity && summary.threadState === 0 && summary.longTermMemory === 0 && summary.pendingApprovals === 0;
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

module.exports = { applySchemaAndMigrations, assertDemoDatabase, columns, connect, insertRows, readSummary, seedDemo, validateSummary };
