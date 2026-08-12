import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_MODEL_VISIBLE_FIELDS, projectActionForModel, projectActionsForModel } from '../operationalDataProjection';

describe('operational action egress allowlist', () => {
  const rawRow = {
    action_id: 'ACT-TEST-001',
    action_description: 'Synthetic description',
    status: 'Open',
    target_date: new Date('2026-01-01T00:00:00Z'),
    days_overdue: '12',
    priority: 'High',
    source_module: 'Inspection',
    project: 'PRJ-SECRET',
    responsible_person: 'Personal Name',
    email: 'person@example.invalid',
    phone: '+000000000',
    employee_id: 'EMP-001',
    closure_date: new Date('2026-02-01T00:00:00Z'),
    source_reference: 'INTERNAL-REF',
    future_database_column: 'must never cross automatically',
  };

  test('contains exactly the reviewed model-visible fields', () => {
    const projected = projectActionForModel(rawRow);
    assert.deepEqual(Object.keys(projected), [...ACTION_MODEL_VISIBLE_FIELDS]);
    assert.deepEqual(projected, {
      actionId: 'ACT-TEST-001',
      description: 'Synthetic description',
      status: 'Open',
      targetDate: '2026-01-01T00:00:00.000Z',
      daysOverdue: 12,
      priority: 'High',
      sourceModule: 'Inspection',
    });
  });

  test('excludes personal, unrelated and future database fields by construction', () => {
    const serialized = JSON.stringify(projectActionsForModel([rawRow]));
    for (const forbidden of [
      'responsible_person', 'Personal Name', 'email', 'person@example.invalid', 'phone',
      'employee_id', 'project', 'closure_date', 'source_reference', 'future_database_column',
    ]) assert.ok(!serialized.includes(forbidden), forbidden);
  });

  test('handles null and invalid optional values safely', () => {
    assert.deepEqual(projectActionForModel({}), {
      actionId: null, description: null, status: null, targetDate: null,
      daysOverdue: null, priority: null, sourceModule: null,
    });
    assert.equal(projectActionForModel({ target_date: 'not-a-date', days_overdue: 'not-a-number' }).targetDate, null);
  });

  test('list_actions applies the allowlist before returning the tool result', () => {
    const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'tools.ts'), 'utf8');
    const block = source.slice(source.indexOf('list_actions:'), source.indexOf('get_projects:'));
    assert.match(block, /const modelRows = projectActionsForModel\(r\.rows\)/);
    assert.match(block, /return operationalResult\(modelRows, modelRows\.length\)/);
    assert.doesNotMatch(block, /return serializeToolRows\(r\.rows\)/);
  });
});
