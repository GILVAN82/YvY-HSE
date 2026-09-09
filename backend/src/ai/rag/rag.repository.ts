import type { Pool, PoolClient } from 'pg';
import type { EmbeddedRagChunk, RagSourceDocument, StoredRagDocument } from './types';

export interface RagRepository {
  findDocument(sourceType: string, sourceReference: string): Promise<StoredRagDocument | null>;
  replaceDocument(document: RagSourceDocument, contentHash: string, chunks: readonly EmbeddedRagChunk[]): Promise<'created' | 'updated'>;
  counts(): Promise<{ documents: number; chunks: number }>;
}

function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

export class PostgresRagRepository implements RagRepository {
  constructor(private readonly db: Pool) {}

  async findDocument(sourceType: string, sourceReference: string): Promise<StoredRagDocument | null> {
    const result = await this.db.query(
      `SELECT id::text, source_type, source_reference, version, content_hash, metadata
       FROM rag_documents WHERE source_type = $1 AND source_reference = $2
       ORDER BY updated_at DESC LIMIT 1`,
      [sourceType, sourceReference]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return { id: row.id, sourceType: row.source_type, sourceReference: row.source_reference, version: row.version, contentHash: row.content_hash, ingestionFingerprint: row.metadata?.ingestionFingerprint };
  }

  async replaceDocument(document: RagSourceDocument, hash: string, chunks: readonly EmbeddedRagChunk[]) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT id FROM rag_documents WHERE source_type = $1 AND source_reference = $2
         ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
        [document.sourceType, document.sourceReference]
      );
      const minimizedMetadata = {
        sensitivity: document.sensitivity,
        ingestionFingerprint: document.metadata?.ingestionFingerprint,
        ...(document.metadata?.language ? { language: document.metadata.language } : {}),
        ...(document.metadata?.citationLabel ? { citationLabel: document.metadata.citationLabel } : {}),
        ...(document.metadata?.sourcePath ? { sourcePath: document.metadata.sourcePath } : {}),
        ...(document.metadata?.effectiveDate ? { effectiveDate: document.metadata.effectiveDate } : {}),
        ...(document.metadata?.revisionDate ? { revisionDate: document.metadata.revisionDate } : {}),
        ...(document.metadata?.sourceOrganization ? { sourceOrganization: document.metadata.sourceOrganization } : {}),
        ...(document.metadata?.jurisdiction ? { jurisdiction: document.metadata.jurisdiction } : {}),
        ...(document.metadata?.sourceUrl ? { sourceUrl: document.metadata.sourceUrl } : {}),
        ...(document.metadata?.secondarySourceUrl ? { secondarySourceUrl: document.metadata.secondarySourceUrl } : {}),
        ...(document.metadata?.contentStatus ? { contentStatus: document.metadata.contentStatus } : {}),
        ...(document.metadata?.accessedOn ? { accessedOn: document.metadata.accessedOn } : {}),
      };
      let id: string;
      let result: 'created' | 'updated';
      if (existing.rowCount) {
        id = existing.rows[0].id;
        await client.query(
          `UPDATE rag_documents SET module=$2, title=$3, version=$4, content_hash=$5,
             metadata=$6::jsonb, updated_at=now() WHERE id=$1`,
          [id, document.module, document.title, document.version, hash, JSON.stringify(minimizedMetadata)]
        );
        await client.query('DELETE FROM rag_chunks WHERE document_id = $1', [id]);
        result = 'updated';
      } else {
        const inserted = await client.query(
          `INSERT INTO rag_documents
             (source_type, source_reference, module, title, version, content_hash, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
          [document.sourceType, document.sourceReference, document.module, document.title, document.version, hash, JSON.stringify(minimizedMetadata)]
        );
        id = inserted.rows[0].id;
        result = 'created';
      }
      await this.insertChunks(client, id, chunks);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertChunks(client: PoolClient, documentId: string, chunks: readonly EmbeddedRagChunk[]) {
    for (const chunk of chunks) {
      await client.query(
        `INSERT INTO rag_chunks (document_id, chunk_index, content, token_count, embedding, metadata)
         VALUES ($1,$2,$3,$4,$5::vector,$6::jsonb)`,
        [documentId, chunk.chunkIndex, chunk.content, chunk.tokenCount, vectorLiteral(chunk.embedding), JSON.stringify(chunk.metadata)]
      );
    }
  }

  async counts() {
    const result = await this.db.query(`
      SELECT (SELECT count(*)::integer FROM rag_documents) AS documents,
             (SELECT count(*)::integer FROM rag_chunks) AS chunks
    `);
    return result.rows[0];
  }
}
