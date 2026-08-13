import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { LongTermMemory, MemoryCategory } from './memory.types';

export interface MemoryRepository {
  findByKey(key: string, userId?: string): Promise<(LongTermMemory & { contentHash: string; enabled: boolean }) | null>;
  findByHash(category: MemoryCategory, hash: string, userId?: string): Promise<LongTermMemory | null>;
  countActive(userId?: string): Promise<number>;
  create(key: string, category: MemoryCategory, content: string, hash: string, userId?: string): Promise<LongTermMemory>;
  update(key: string, category: MemoryCategory, content: string, hash: string, userId?: string): Promise<LongTermMemory>;
  listActive(limit: number, userId?: string): Promise<LongTermMemory[]>;
  touch(ids: readonly string[], userId?: string): Promise<void>;
  disable(key: string, userId?: string): Promise<boolean>;
}

function map(row: any): LongTermMemory {
  return { id: row.id, memoryKey: row.memory_key, category: row.category, content: row.content };
}

export class PostgresMemoryRepository implements MemoryRepository {
  constructor(private readonly db: Pool) {}
  async findByKey(key: string, userId?: string) {
    const r = await this.db.query('SELECT id::text, memory_key, category, content, content_hash, enabled FROM agent_long_term_memory WHERE memory_key=$1 AND user_id=$2', [key,userId]);
    return r.rowCount ? { ...map(r.rows[0]), contentHash: r.rows[0].content_hash, enabled: r.rows[0].enabled } : null;
  }
  async findByHash(category: MemoryCategory, hash: string, userId?: string) {
    const r = await this.db.query('SELECT id::text, memory_key, category, content FROM agent_long_term_memory WHERE category=$1 AND content_hash=$2 AND user_id=$3 AND enabled=true', [category, hash,userId]);
    return r.rowCount ? map(r.rows[0]) : null;
  }
  async countActive(userId?: string) { const r = await this.db.query('SELECT count(*)::int AS count FROM agent_long_term_memory WHERE enabled=true AND user_id=$1',[userId]); return r.rows[0].count; }
  async create(key: string, category: MemoryCategory, content: string, hash: string, userId?: string) {
    const r = await this.db.query('INSERT INTO agent_long_term_memory(id,memory_key,category,content,content_hash,user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text,memory_key,category,content', [randomUUID(),key,category,content,hash,userId]); return map(r.rows[0]);
  }
  async update(key: string, category: MemoryCategory, content: string, hash: string, userId?: string) {
    const r = await this.db.query('UPDATE agent_long_term_memory SET category=$2,content=$3,content_hash=$4,enabled=true,updated_at=now() WHERE memory_key=$1 AND user_id=$5 RETURNING id::text,memory_key,category,content', [key,category,content,hash,userId]); return map(r.rows[0]);
  }
  async listActive(limit:number,userId?:string){const r=await this.db.query('SELECT id::text,memory_key,category,content FROM agent_long_term_memory WHERE enabled=true AND user_id=$2 ORDER BY updated_at DESC LIMIT $1',[limit,userId]);return r.rows.map(map);}
  async touch(ids:readonly string[],userId?:string){if(ids.length)await this.db.query('UPDATE agent_long_term_memory SET last_used_at=now() WHERE id=ANY($1::uuid[]) AND user_id=$2',[[...ids],userId]);}
  async disable(key:string,userId?:string){const r=await this.db.query('UPDATE agent_long_term_memory SET enabled=false,updated_at=now() WHERE memory_key=$1 AND user_id=$2 AND enabled=true',[key,userId]);return !!r.rowCount;}
}
