import type { Pool } from 'pg';
import { validateEmbedding } from './embedding.service';
import type { RagEvidence } from './retrieval.types';

export interface RagRetrievalRepository {
  searchByEmbedding(embedding: readonly number[], topK: number, minSimilarity: number): Promise<RagEvidence[]>;
}

function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

export class PostgresRagRetrievalRepository implements RagRetrievalRepository {
  constructor(private readonly db: Pool, private readonly dimensions = 1536) {}

  async searchByEmbedding(embedding: readonly number[], topK: number, minSimilarity: number): Promise<RagEvidence[]> {
    const vector = vectorLiteral(validateEmbedding(embedding, this.dimensions));
    const result = await this.db.query(
      `WITH ranked AS (
         SELECT c.id::text AS chunk_id, d.id::text AS document_id, c.content,
                1 - (c.embedding <=> $1::vector) AS score,
                d.source_reference, d.title, d.module, d.version, d.metadata
         FROM rag_chunks c
         JOIN rag_documents d ON d.id = c.document_id
       )
       SELECT chunk_id, document_id, content, score, source_reference, title, module, version,
              metadata->>'citationLabel' AS citation_label,
              metadata->>'sourceOrganization' AS source_organization,
              metadata->>'jurisdiction' AS jurisdiction,
              metadata->>'sourceUrl' AS source_url
       FROM ranked
       WHERE score >= $2
       ORDER BY score DESC, chunk_id ASC
       LIMIT $3`,
      [vector, minSimilarity, topK]
    );
    return result.rows.map((row) => ({
      chunkId: row.chunk_id, documentId: row.document_id, content: row.content,
      score: Number(row.score), sourceId: row.source_reference, title: row.title,
      module: row.module, version: row.version, citationLabel: row.citation_label ?? row.title,
      sourceOrganization: row.source_organization ?? '', jurisdiction: row.jurisdiction ?? '',
      sourceUrl: row.source_url ?? '',
    }));
  }
}
