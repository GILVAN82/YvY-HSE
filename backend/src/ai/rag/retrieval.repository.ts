import type { Pool } from 'pg';
import { validateEmbedding } from './embedding.service';
import { z } from 'zod';
import { isInfrastructureError, VectorRetrievalError, LexicalRetrievalError, MalformedRetrievalRowError } from './errors';
import { lexicalTerms } from './queryPlan';
import type { RagEvidence } from './retrieval.types';

export interface RagRetrievalRepository {
  searchLexical?(query: string, topK: number): Promise<RagEvidence[]>;
  searchByEmbedding(embedding: readonly number[], topK: number, minSimilarity: number): Promise<RagEvidence[]>;
}

function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

export class PostgresRagRetrievalRepository implements RagRetrievalRepository {
  constructor(private readonly db: Pool, private readonly dimensions = 1536) {}

  async searchByEmbedding(embedding: readonly number[], topK: number, minSimilarity: number): Promise<RagEvidence[]> {
    const vector = vectorLiteral(validateEmbedding(embedding, this.dimensions));
    const result = await this.queryVector(
      `WITH ranked AS (
         SELECT COALESCE(c.metadata->>'stableChunkId', c.id::text) AS chunk_id, d.id::text AS document_id, c.content,
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
    return result.rows.map(parseRetrievalRow);
  }

  private async queryVector(sql: string, parameters: unknown[]) {
    try { return await this.db.query(sql, parameters); }
    catch (error) {
      if (isInfrastructureError(error)) throw new VectorRetrievalError('Vector retrieval unavailable', { cause: error });
      throw error;
    }
  }

  async searchLexical(query: string, topK: number): Promise<RagEvidence[]> {
    const terms = lexicalTerms(query);
    if (!terms.length) return [];
    // plainto_tsquery receives each term as data; OR supports partial candidate recall.
    // Exact token matching is additionally enforced by the service relevance gate.
    let result;
    try {
      result = await this.db.query(`WITH q AS (
        SELECT to_tsquery('simple', string_agg(plainto_tsquery('simple', term)::text, ' | ')) AS query
        FROM unnest($1::text[]) AS term
      )
      SELECT COALESCE(c.metadata->>'stableChunkId', c.id::text) AS chunk_id,
        d.id::text AS document_id, c.content, ts_rank_cd(to_tsvector('simple', c.content), q.query) AS score,
        d.source_reference, d.title, d.module, d.version,
        d.metadata->>'citationLabel' AS citation_label, d.metadata->>'sourceOrganization' AS source_organization,
        d.metadata->>'jurisdiction' AS jurisdiction, d.metadata->>'sourceUrl' AS source_url
      FROM rag_chunks c JOIN rag_documents d ON d.id=c.document_id CROSS JOIN q
      WHERE to_tsvector('simple', c.content) @@ q.query
      ORDER BY score DESC, chunk_id ASC LIMIT $2`, [terms, topK]);
    } catch (error) {
      if (isInfrastructureError(error)) throw new LexicalRetrievalError('Lexical retrieval unavailable', { cause: error });
      throw error;
    }
    return result.rows.map(parseRetrievalRow);
  }
}
const RowSchema = z.object({
  chunk_id: z.string().min(1), document_id: z.string().min(1), content: z.string().min(1),
  score: z.union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i)]).transform(Number).pipe(z.number().finite()),
  source_reference: z.string().min(1), title: z.string().min(1), module: z.string().min(1), version: z.string().min(1),
  citation_label: z.string().nullish(), source_organization: z.string().nullish(), jurisdiction: z.string().nullish(), source_url: z.string().nullish(),
});
export function parseRetrievalRow(value: unknown): RagEvidence {
  const parsed = RowSchema.safeParse(value);
  if (!parsed.success) throw new MalformedRetrievalRowError('Malformed retrieval row');
  const row = parsed.data;
  return { chunkId: row.chunk_id, documentId: row.document_id, content: row.content,
    score: row.score, sourceId: row.source_reference, title: row.title, module: row.module, version: row.version,
    citationLabel: row.citation_label ?? row.title, sourceOrganization: row.source_organization ?? '',
    jurisdiction: row.jurisdiction ?? '', sourceUrl: row.source_url ?? '' };
}
