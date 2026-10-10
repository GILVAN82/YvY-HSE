import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyModelFailure, fingerprintModelFailure } from '../modelFailure';

describe('safe model failure classification', () => {
  test('classifies provider failures without returning raw text', () => {
    assert.equal(classifyModelFailure({ statusCode: 400, message: 'Invalid prompt payload' }), 'MESSAGE_FORMAT_ERROR');
    assert.equal(classifyModelFailure({ statusCode: 401, message: 'invalid api key secret-value' }), 'AUTHENTICATION_ERROR');
    assert.equal(classifyModelFailure({ statusCode: 404, message: 'model does not exist' }), 'MODEL_NOT_AVAILABLE');
    assert.equal(classifyModelFailure(new Error('socket timeout')), 'TIMEOUT');
    assert.equal(classifyModelFailure(Object.assign(new Error('connect denied'), { code: 'EACCES' })), 'NETWORK_ERROR');
    assert.equal(classifyModelFailure('stream interrupted'), 'STREAMING_ERROR');
  });

  test('safe fingerprint contains no raw message', () => {
    const result = fingerprintModelFailure(Object.assign(new Error('secret raw provider text'), { statusCode: 429, code: 'rate_limit' }));
    assert.deepEqual(result, {
      errorType: 'Error', httpStatus: 429, providerCode: 'rate_limit', failureStage: 'MODEL_STREAM', category: 'RATE_LIMIT',
    });
    assert.ok(!JSON.stringify(result).includes('secret raw provider text'));
  });
});
