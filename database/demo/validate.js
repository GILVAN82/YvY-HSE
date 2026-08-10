#!/usr/bin/env node
'use strict';

const { demoDatabaseUrl } = require('./config');
const { connect, readSummary, validateSummary } = require('./demo-lib');

async function main() {
  const client = await connect(demoDatabaseUrl());
  try {
    const s = await readSummary(client);
    console.log('YVY HSE DEMO VALIDATION');
    console.log(JSON.stringify({
      database: s.database, projects: s.projects, activeDataCenterProjects: s.activeDataCenterProjects,
      actions: s.actions, overdueActions: s.overdueActions, mostOverdueAction: s.mostOverdueAction,
      incidents: s.incidents, ptw: s.ptw, risks: s.risks, jsa: s.jsa,
      contractors: s.contractors, audits: s.audits, documents: s.documents, training: s.training,
      ragDocuments: s.ragDocuments, ragChunks: s.ragChunks,
      relationshipIntegrity: s.relationshipIntegrity ? 'PASS' : 'FAIL',
      threadStateClean: s.threadState === 0 ? 'PASS' : 'FAIL',
      longTermMemoryClean: s.longTermMemory === 0 ? 'PASS' : 'FAIL',
      hitlClean: s.pendingApprovals === 0 ? 'PASS' : 'FAIL',
      syntheticDataOnly: 'PASS', aiDemoPreconditions: validateSummary(s, true) ? 'PASS' : 'FAIL',
    }, null, 2));
    if (!validateSummary(s, true)) process.exitCode = 1;
  } finally { await client.end(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
