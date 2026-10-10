import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ragResultEvidence, toolResultEvidence, VerificationStatus, type AgentEvidence } from '../graph/evidence.contract';
import { verifyEvidenceContract } from '../graph/semanticVerifier';
import { resetGraphCache, runHseAgent } from '../graph/hseAgent.runner';
import { AgentErrorCode, AgentStatus, type AgentEvent } from '../graph/hseAgent.types';
import { createHermeticToolFactory, createMockModel } from './mockModel';
import { createHseTools } from '../tools';

const toolEvidence = (status: 'SUCCESS_WITH_DATA' | 'SUCCESS_NO_DATA', recordCount: number, data: unknown = []) =>
  toolResultEvidence('list_actions', { status, recordCount, data }, 0);

const ragEvidence = (content = 'LOTO requires energy isolation and verification of zero energy before work begins.', label = 'OSHA LOTO') =>
  ragResultEvidence({ chunkId:'chunk-1',documentId:'doc-1',content,score:0.9,sourceId:'loto-source',title:'LOTO',module:'LOTO',version:'1',citationLabel:label,sourceOrganization:'OSHA',jurisdiction:'US',sourceUrl:'https://example.test' });

describe('semantic evidence contract', () => {
  const datedActions = () => toolEvidence('SUCCESS_WITH_DATA', 2, [
    { actionId: 'ACT-001', targetDate: '2026-06-23T00:00:00.000Z', daysOverdue: 76 },
    { actionId: 'ACT-002', targetDate: '2026-06-30T00:00:00.000Z', daysOverdue: 69 },
  ]);
  test('dates and identifiers retain their structured evidence, including Portuguese date formatting', () => {
    for (const date of ['2026-06-23', '23/06/2026', '23.06.2026', '2026-06-23T00:00:00.000Z']) {
      const result = verifyEvidenceContract(`A ação ACT-001 tem prazo em ${date}, com 76 dias de atraso.`, [datedActions()]);
      assert.equal(result.status, VerificationStatus.VERIFIED, JSON.stringify(result));
    }
  });
  test('a numbered action list is not mistaken for additional operational quantities', () => {
    const result = verifyEvidenceContract('1. A ação ACT-001 venceu em 23/06/2026.\n2. A ação ACT-002 venceu em 30/06/2026.', [datedActions()]);
    assert.equal(result.status, VerificationStatus.VERIFIED);
  });
  test('fabricated dates, identifiers and dates borrowed from another record remain blocked', () => {
    for (const text of [
      'A ação ACT-001 venceu em 2026-06-24.',
      'A ação ACT-001 venceu em 30/06/2026.',
      'A ação ACT-999 venceu em 23/06/2026.',
      'A ação ACT-001 venceu em 31/02/2026.',
      'A ação ACT-001 venceu em 2026-06-23T12:00:00.000Z.',
    ]) assert.equal(verifyEvidenceContract(text, [datedActions()]).status, VerificationStatus.CONTRADICTED, text);
  });
  test('date components and identifier digits cannot authorize invented counts', () => {
    for (const count of [2026, 23, 999]) {
      assert.equal(verifyEvidenceContract(`There are ${count} overdue actions.`, [datedActions()]).status, VerificationStatus.CONTRADICTED);
    }
  });
  test('structured records cannot be asserted when the tool returned no data', () => {
    assert.equal(verifyEvidenceContract('A ação ACT-001 venceu em 23/06/2026.', [toolEvidence('SUCCESS_NO_DATA', 0)]).status, VerificationStatus.CONTRADICTED);
  });
  test('tool says zero and answer says zero is verified', () => {
    const result=verifyEvidenceContract('No overdue actions were found. There are 0 overdue actions.',[toolEvidence('SUCCESS_NO_DATA',0)]);
    assert.equal(result.status,VerificationStatus.VERIFIED); assert.equal(result.unsupportedClaims,0);
  });
  test('tool says zero and answer claims records exist is contradicted', () => {
    const result=verifyEvidenceContract('There are 3 overdue actions.',[toolEvidence('SUCCESS_NO_DATA',0)]);
    assert.equal(result.status,VerificationStatus.CONTRADICTED); assert.equal(result.unsupportedClaims,1);
  });
  test('tool says three and compatible answer is verified', () => {
    const result=verifyEvidenceContract('There are 3 overdue actions.',[toolEvidence('SUCCESS_WITH_DATA',3,[{actionId:'A1'},{actionId:'A2'},{actionId:'A3'}])]);
    assert.equal(result.status,VerificationStatus.VERIFIED);
  });
  test('tool error cannot support a successful operational claim', () => {
    const failed=toolResultEvidence('list_actions',{error:true,message:'controlled'},0);
    const result=verifyEvidenceContract('There are 3 overdue actions.',[failed]);
    assert.equal(result.status,VerificationStatus.CONTRADICTED);
  });
  test('retrieved evidence supports a cited safety answer', () => {
    const result=verifyEvidenceContract('The LOTO procedure requires energy isolation and verification of zero energy [OSHA LOTO].',[ragEvidence()]);
    assert.equal(result.status,VerificationStatus.VERIFIED);
  });
  test('procedural assertion without RAG evidence is safety blocked', () => {
    const result=verifyEvidenceContract('The LOTO procedure requires verification of zero energy.',[]);
    assert.equal(result.status,VerificationStatus.SAFETY_BLOCKED);
  });
  test('citation to a non-retrieved source fails', () => {
    const result=verifyEvidenceContract('The LOTO procedure requires zero-energy verification [ISO 45001].',[ragEvidence()]);
    assert.equal(result.status,VerificationStatus.SAFETY_BLOCKED);
    assert.match(result.reasons.join(' '),/does not correspond/);
  });
  test('retrieved source must lexically support the important claim', () => {
    const result=verifyEvidenceContract('The LOTO procedure requires a confined-space gas test [OSHA LOTO].',[ragEvidence('LOTO requires isolation and zero-energy verification.')]);
    assert.equal(result.status,VerificationStatus.SAFETY_BLOCKED);
  });
  test('unsupported safety-critical claim fails closed', () => {
    const result=verifyEvidenceContract('LOTO must always be removed remotely before verification.',[]);
    assert.equal(result.status,VerificationStatus.SAFETY_BLOCKED);
  });
  test('memory alone cannot establish current operational state', () => {
    const result=verifyEvidenceContract('There are 4 open incidents.',[]);
    assert.equal(result.status,VerificationStatus.INSUFFICIENT_EVIDENCE);
  });
  test('pending LOTO cannot be described as approved', () => {
    const result=verifyEvidenceContract('This LOTO is approved and safe.',[]);
    assert.equal(result.status,VerificationStatus.SAFETY_BLOCKED);
  });
  test('digital approval cannot be described as physical completion', () => {
    const result=verifyEvidenceContract('The physical LOTO was completed and the equipment is safe.',[]);
    assert.equal(result.status,VerificationStatus.SAFETY_BLOCKED);
  });
  test('evidence projection excludes sensitive and raw descriptive fields', () => {
    const evidence=toolResultEvidence('list_incidents',{status:'SUCCESS_WITH_DATA',recordCount:1,data:[{project_code:'P1',description:'private narrative',responsible_person:'Person',severity:'Low'}]},0);
    assert.equal(evidence.recordCount,1); assert.deepEqual(evidence.facts?.map(f=>f.path),['data[0].project_code','data[0].severity']);
  });
});

describe('verify node fail-closed integration', () => {
  test('Portuguese overdue action response with dates completes the real tool and graph flow', async () => {
    const events: AgentEvent[] = [];
    const answer = '1. A ação ACT-001 venceu em 23/06/2026, com 76 dias de atraso.';
    const database = { query: async () => ({ rows: [{ action_id: 'ACT-001', action_description: 'Synthetic inspection',
      target_date: new Date('2026-06-23T00:00:00.000Z'), days_overdue: 76, status: 'Open', priority: 'High', source_module: 'Synthetic' }], rowCount: 1 }) };
    const result = await runHseAgent({
      message: 'Quais ações estão atrasadas?', locale: 'pt',
      model: createMockModel([{ toolCall: { name: 'list_actions', input: '{"overdue":true}' } }, { text: answer }]),
      tools: createHseTools(database as any, async () => ({}), { retrieve: async () => ({ status: 'NO_RELEVANT_EVIDENCE', evidence: [] }) }),
      emit: event => events.push(event),
    });
    assert.equal(result.status, AgentStatus.COMPLETED);
    assert.equal(result.executionTrace!.verification.status, VerificationStatus.VERIFIED);
    assert.deepEqual(result.toolsUsed, ['list_actions']);
    assert.equal(events.filter(event => event.type === 'text').map(event => event.text).join(''), answer);
  });
  test('unsupported evidence result is serializable and contains no reasoning trace', () => {
    const evidence:AgentEvidence[]=[toolEvidence('SUCCESS_NO_DATA',0)];
    const result=verifyEvidenceContract('There are 2 incidents.',evidence);
    assert.doesNotMatch(JSON.stringify(result),/chain.of.thought|prompt|password/i);
    assert.equal(result.evidenceItemsConsidered,1);
  });

  test('contradicted operational output is replaced before any text is emitted', async () => {
    resetGraphCache();
    const events: AgentEvent[] = [];
    const result = await runHseAgent({
      message: 'How many overdue actions are there?',
      model: createMockModel([
        { toolCall: { name: 'list_actions', input: '{}' } },
        { text: 'There are 3 overdue actions.' },
      ]),
      emit: (event) => events.push(event),
      toolFactory: createHermeticToolFactory(),
    });

    const emittedText = events.filter((event) => event.type === 'text').map((event) => event.text).join(' ');
    assert.equal(result.status, AgentStatus.FAILED);
    assert.equal(result.errorCode, AgentErrorCode.SEMANTIC_VERIFICATION);
    assert.equal(result.executionTrace!.verification.status, VerificationStatus.CONTRADICTED);
    assert.doesNotMatch(result.text, /3 overdue actions/i);
    assert.doesNotMatch(emittedText, /3 overdue actions/i);
    assert.match(emittedText, /verified evidence/i);
  });

  test('unsupported safety output is replaced before any text is emitted', async () => {
    resetGraphCache();
    const events: AgentEvent[] = [];
    const result = await runHseAgent({
      message: 'What LOTO controls apply?',
      model: createMockModel([{ text: 'LOTO must always be removed remotely before verification.' }]),
      emit: (event) => events.push(event),
      toolFactory: createHermeticToolFactory(),
    });

    const emittedText = events.filter((event) => event.type === 'text').map((event) => event.text).join(' ');
    assert.equal(result.status, AgentStatus.FAILED);
    assert.equal(result.executionTrace!.verification.status, VerificationStatus.SAFETY_BLOCKED);
    assert.doesNotMatch(result.text, /removed remotely/i);
    assert.doesNotMatch(emittedText, /removed remotely/i);
  });
});
