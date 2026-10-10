import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadBackendEnvironment, requireOpenAIConfiguration } from '../env';

function temporaryEnv(content: string, run: (file: string) => void) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hse-env-test-'));
  const file = path.join(directory, '.env');
  try {
    fs.writeFileSync(file, content, 'utf8');
    run(file);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('loads an explicit backend env path independently of current working directory', () => {
  temporaryEnv('OPENAI_API_KEY=fake-local-test-value\n', (file) => {
    const target = {} as NodeJS.ProcessEnv;
    const status = loadBackendEnvironment(target, file);
    assert.equal(status.fileLoaded, true);
    assert.equal(status.openAIConfigured, true);
    assert.equal(target.OPENAI_API_KEY, 'fake-local-test-value');
  });
});

test('injected process environment takes precedence over local env', () => {
  temporaryEnv('OPENAI_API_KEY=fake-local-test-value\n', (file) => {
    const target = { OPENAI_API_KEY: 'fake-injected-test-value' } as NodeJS.ProcessEnv;
    loadBackendEnvironment(target, file);
    assert.equal(target.OPENAI_API_KEY, 'fake-injected-test-value');
  });
});

test('empty process environment does not override a non-empty local value', () => {
  temporaryEnv('OPENAI_API_KEY=fake-local-test-value\n', (file) => {
    const target = { OPENAI_API_KEY: '' } as NodeJS.ProcessEnv;
    loadBackendEnvironment(target, file);
    assert.equal(target.OPENAI_API_KEY, 'fake-local-test-value');
  });
});

test('whitespace process environment does not override a non-empty local value', () => {
  temporaryEnv('OPENAI_API_KEY=fake-local-test-value\n', (file) => {
    const target = { OPENAI_API_KEY: '   ' } as NodeJS.ProcessEnv;
    loadBackendEnvironment(target, file);
    assert.equal(target.OPENAI_API_KEY, 'fake-local-test-value');
  });
});

test('default backend env path is independent of process.cwd()', () => {
  const expected = path.resolve(__dirname, '../../../.env');
  const previous = process.cwd();
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'hse-cwd-test-'));
  try {
    process.chdir(elsewhere);
    const { BACKEND_ENV_PATH } = require('../env');
    assert.equal(BACKEND_ENV_PATH, expected);
    assert.equal(path.basename(BACKEND_ENV_PATH), '.env');
    assert.equal(path.basename(path.dirname(BACKEND_ENV_PATH)), 'backend');
    assert.ok(!BACKEND_ENV_PATH.endsWith('backend.env'));
  } finally {
    process.chdir(previous);
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('RAG CLI and backend runtime import the same bootstrap', () => {
  const root = path.resolve(__dirname, '../..');
  const server = fs.readFileSync(path.join(root, 'index.ts'), 'utf8');
  const cli = fs.readFileSync(path.join(root, 'ai/rag/ingest.cli.ts'), 'utf8');
  assert.match(server, /config\/env\.bootstrap/);
  assert.match(cli, /config\/env\.bootstrap/);
});

test('embedding service receives an injected fake key without logging it', () => {
  const output: unknown[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => { output.push(args); };
  console.error = (...args: unknown[]) => { output.push(args); };
  try {
    const { OpenAIEmbeddingService } = require('../../ai/rag/embedding.service');
    const service = new OpenAIEmbeddingService({ model: 'fake-model', dimensions: 3 }, 'fake-test-key');
    assert.equal((service as any).apiKey, 'fake-test-key');
    assert.deepEqual(output, []);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
});

test('safe OpenAI validation rejects empty values without exposing a secret', () => {
  assert.throws(() => requireOpenAIConfiguration({ OPENAI_API_KEY: '   ' } as NodeJS.ProcessEnv), /not configured/);
  assert.doesNotThrow(() => requireOpenAIConfiguration({ OPENAI_API_KEY: 'fake-test-value' } as NodeJS.ProcessEnv));
});
