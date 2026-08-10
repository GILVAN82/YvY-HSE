import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_OVERDUE_SQL, isActionOverdue } from '../actions';

describe('shared overdue action rule', () => {
  const now = new Date('2026-08-08T12:00:00Z');

  test('closed past-due action is not overdue', () => {
    assert.equal(isActionOverdue({ status: 'Closed', target_date: '2026-01-01T00:00:00Z' }, now), false);
  });

  test('non-closed past-due action is overdue', () => {
    assert.equal(isActionOverdue({ status: 'Open', target_date: '2026-01-01T00:00:00Z' }, now), true);
  });

  test('future action is not overdue', () => {
    assert.equal(isActionOverdue({ status: 'In Progress', target_date: '2026-12-01T00:00:00Z' }, now), false);
  });

  test('action without target date is not overdue', () => {
    assert.equal(isActionOverdue({ status: 'Open', target_date: null }, now), false);
  });

  test('SQL equivalent is read-only and uses the same three conditions', () => {
    assert.match(ACTION_OVERDUE_SQL, /status IS DISTINCT FROM 'Closed'/);
    assert.match(ACTION_OVERDUE_SQL, /target_date IS NOT NULL/);
    assert.match(ACTION_OVERDUE_SQL, /target_date < CURRENT_TIMESTAMP/);
    assert.doesNotMatch(ACTION_OVERDUE_SQL, /INSERT|UPDATE|DELETE/i);
  });
});
