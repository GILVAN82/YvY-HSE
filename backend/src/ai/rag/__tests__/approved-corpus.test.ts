import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RAG_SOURCE_REGISTRY, reviewRegisteredSources } from '../sourceRegistry';

test('the four reviewed production sources pass onboarding validation', async () => {
  const review = await reviewRegisteredSources();
  assert.equal(RAG_SOURCE_REGISTRY.length, 4);
  assert.equal(review.approved.length, 4);
  assert.deepEqual(review.invalid, []);
  assert.deepEqual(review.sensitive, []);
  assert.deepEqual(review.promptInjectionWarnings, []);
  assert.ok(review.approved.every((source) => source.metadata?.contentStatus === 'curated_summary_not_official_text'));
});
