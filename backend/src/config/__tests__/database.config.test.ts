import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readSafeDatabaseConfig, requireDatabaseUrl } from '../../db/config';

describe('centralized database configuration', () => {
  test('fails closed instead of silently connecting to a fallback database', () => {
    assert.throws(() => requireDatabaseUrl({}), /required/);
  });

  test('derives only safe connection identity from the configured URL', () => {
    const environment = { DATABASE_URL: 'postgresql://example-user:example-password@db.internal:5544/hse_test?sslmode=require' };
    assert.deepEqual(readSafeDatabaseConfig(environment), {
      host: 'db.internal', port: 5544, database: 'hse_test', sslRequested: true,
    });
    assert.doesNotMatch(JSON.stringify(readSafeDatabaseConfig(environment)), /example-user|example-password/);
  });
});
