import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentStatus } from '../graph/hseAgent.types';
import { resolveResponseStatus } from '../responseStatus';

describe('public AI response semantics', () => {
  test('maps successful operational results with and without records', () => {
    assert.equal(resolveResponseStatus({ status: AgentStatus.COMPLETED, tools: [{ name: 'list_incidents', status: 'COMPLETED', resultStatus: 'SUCCESS_WITH_DATA' }] }), 'SUCCESS');
    assert.equal(resolveResponseStatus({ status: AgentStatus.COMPLETED, tools: [{ name: 'list_incidents', status: 'COMPLETED', resultStatus: 'SUCCESS_NO_DATA' }] }), 'NO_DATA');
  });
  test('maps RAG evidence and no-evidence without confusing absence with failure', () => {
    assert.equal(resolveResponseStatus({ status: AgentStatus.COMPLETED, ragStatus: 'OK' }), 'SUCCESS');
    assert.equal(resolveResponseStatus({ status: AgentStatus.COMPLETED, ragStatus: 'NO_RELEVANT_EVIDENCE' }), 'NO_DATA');
    assert.equal(resolveResponseStatus({ status: AgentStatus.FAILED, ragStatus: 'ERROR' }), 'ERROR');
  });
  test('maps real tool and provider failures to ERROR', () => {
    assert.equal(resolveResponseStatus({ status: AgentStatus.FAILED, errorCode: 'AI_TOOL_FAILURE' }), 'ERROR');
    assert.equal(resolveResponseStatus({ status: AgentStatus.FAILED, errorCode: 'AI_MODEL_ERROR' }), 'ERROR');
  });
  test('maps HITL lifecycle decisions and guard refusals distinctly', () => {
    assert.equal(resolveResponseStatus({ status: AgentStatus.AWAITING_HUMAN_APPROVAL, approvalStatus: 'PENDING' }), 'PENDING');
    assert.equal(resolveResponseStatus({ status: AgentStatus.COMPLETED, approvalStatus: 'APPROVED' }), 'APPROVED');
    assert.equal(resolveResponseStatus({ status: AgentStatus.COMPLETED, approvalStatus: 'REJECTED' }), 'REJECTED');
    assert.equal(resolveResponseStatus({ status: AgentStatus.REFUSED }), 'REFUSED');
  });
});
