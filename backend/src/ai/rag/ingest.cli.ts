import '../../config/env.bootstrap';
import { OpenAIEmbeddingService } from './embedding.service';
import { RagIngestionService } from './ingestion.service';
import { PostgresRagRepository } from './rag.repository';
import { EXCLUDED_SOURCE_REGISTRY, reviewRegisteredSources, RAG_SOURCE_REGISTRY, SENSITIVE_SOURCE_GROUPS_EXCLUDED } from './sourceRegistry';
import { pool } from '../../db/pool';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const review = await reviewRegisteredSources();
  const sources = review.approved;
  const service = new RagIngestionService(new PostgresRagRepository(), new OpenAIEmbeddingService());
  const result = await service.ingest(sources, { dryRun });
  console.log(JSON.stringify({
    ...result,
    approvedSources: RAG_SOURCE_REGISTRY.length,
    excludedSources: EXCLUDED_SOURCE_REGISTRY.length,
    sensitiveSourceGroupsExcluded: SENSITIVE_SOURCE_GROUPS_EXCLUDED,
    registryReview: {
      APPROVED: review.approved.map((source) => source.sourceReference),
      EXCLUDED: review.excluded,
      INVALID: review.invalid,
      SENSITIVE: review.sensitive,
      'PROMPT-INJECTION WARNING': review.promptInjectionWarnings,
    },
  }, null, 2));
  if (result.errors.length || review.invalid.length || review.sensitive.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'RAG ingestion failed');
  process.exitCode = 1;
}).finally(() => pool.end());
