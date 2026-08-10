import '../../config/env.bootstrap';
import { RagRetrievalService } from './retrieval.service';
import { pool } from '../../db/pool';

const queries = [
  ['loto', 'What controls are required before servicing locked-out equipment?'],
  ['loto_precautions', 'What precautions should be taken before performing lockout/tagout?'],
  ['emergency', 'What should an emergency response plan cover?'],
  ['risk', 'How should a workplace risk assessment be performed?'],
  ['ptw', 'When should a permit-to-work system be used?'],
  ['unrelated', 'What is the company holiday policy?'],
  ['structured', 'How many open incidents are there currently?'],
] as const;

async function main() {
  const configured = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim().length > 0;
  console.log(`OPENAI API CONFIGURED: ${configured ? 'YES' : 'NO'}`);
  if (!configured) process.exitCode = 1;
  else {
    const service = new RagRetrievalService();
    for (const [id, query] of queries) {
      const result = await service.retrieve(query);
      console.log(JSON.stringify({ queryId: id, status: result.status, count: result.evidence.length, sources: result.evidence.map((item) => item.sourceId), scores: result.evidence.map((item) => Number(item.score.toFixed(4))) }));
    }
  }
}

main().catch((error) => {
  console.error(`RAG retrieval smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 1;
}).finally(() => pool.end());
