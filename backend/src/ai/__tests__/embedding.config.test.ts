import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
  readEmbeddingConfig,
} from '../embedding.config';

test('embedding configuration has the intended centralized defaults', () => {
  assert.deepEqual(readEmbeddingConfig({} as NodeJS.ProcessEnv), {
    model: DEFAULT_EMBEDDING_MODEL,
    dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
  });
  assert.equal(DEFAULT_EMBEDDING_MODEL, 'text-embedding-3-small');
  assert.equal(DEFAULT_EMBEDDING_DIMENSIONS, 1536);
});

test('embedding dimensions reject invalid configuration', () => {
  assert.throws(
    () => readEmbeddingConfig({ EMBEDDING_DIMENSIONS: 'not-a-number' } as NodeJS.ProcessEnv),
    /positive integer/
  );
});
