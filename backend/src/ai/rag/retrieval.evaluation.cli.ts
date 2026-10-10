import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { evaluateRetrieval } from './retrieval.evaluation';
import { provenance } from '../evaluation/evaluation.provenance';
import { withoutNetwork } from '../evaluation/offline-network';

async function main() {
  const result = await evaluateRetrieval();
  const metadata = provenance(result.dataset, 'SIMULATED', null, null, 1);
  const artifact = { ...result, provenance: { ...metadata, corpusFingerprint: result.corpus.fingerprint,
    retrievalConfigVersion: result.comparisonConfigFingerprint } };
  const folder = path.resolve(__dirname, '../../../../artifacts/evaluation'); mkdirSync(folder, { recursive: true });
  const filename = path.join(folder, `${metadata.timestamp.replace(/[:.]/g, '-')}-${metadata.gitCommit.slice(0, 12)}-retrieval.json`);
  writeFileSync(filename, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ artifact: filename, modes: result.modes.map(m => ({ mode: m.mode, metrics: m.metrics })) }, null, 2));
}
withoutNetwork(main).catch(error => { console.error(error); process.exitCode = 1; });
