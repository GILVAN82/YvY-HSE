import type { Pool } from 'pg';
import { MAX_HISTORY_TURNS } from '../config';
import type { ChatTurn } from './hseAgent.state';

export interface ThreadSourceReference {
  sourceId: string;
  citationLabel: string;
  sourceUrl: string;
  jurisdiction: string;
}

export interface PersistedThreadState {
  threadId: string;
  messages: ChatTurn[];
  lastRagUsed: boolean;
  sourceReferences: ThreadSourceReference[];
  version: number;
  updatedAt?: string;
}

export interface ThreadStateStore {
  load(threadId: string): Promise<PersistedThreadState | null>;
  save(state: Omit<PersistedThreadState, 'version' | 'updatedAt'>): Promise<void>;
  reset(threadId: string): Promise<void>;
}

export function sanitizePersistedContent(content: string): string {
  return content
    .replace(/\b(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|DATABASE_URL)\s*[=:]\s*\S+/gi, '[REDACTED_CREDENTIAL]')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]');
}

export function minimizeThreadMessages(messages: readonly ChatTurn[]): ChatTurn[] {
  return messages.slice(-MAX_HISTORY_TURNS).map(({ role, content }) => ({ role, content: sanitizePersistedContent(content) }));
}

function safeContext(value: unknown): { lastRagUsed: boolean; sourceReferences: ThreadSourceReference[] } {
  const context = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const refs = Array.isArray(context.sourceReferences) ? context.sourceReferences : [];
  return {
    lastRagUsed: context.lastRagUsed === true,
    sourceReferences: refs.filter((ref): ref is ThreadSourceReference => {
      if (!ref || typeof ref !== 'object') return false;
      const item = ref as Record<string, unknown>;
      return ['sourceId', 'citationLabel', 'sourceUrl', 'jurisdiction'].every((key) => typeof item[key] === 'string');
    }),
  };
}

export class PostgresThreadStateStore implements ThreadStateStore {
  constructor(private readonly db: Pool) {}

  async load(threadId: string): Promise<PersistedThreadState | null> {
    const result = await this.db.query(
      `SELECT thread_id::text, messages, context, version, updated_at
       FROM agent_thread_state WHERE thread_id = $1`, [threadId]
    );
    if (!result.rowCount) return null;
    const row = result.rows[0];
    const context = safeContext(row.context);
    return { threadId: row.thread_id, messages: minimizeThreadMessages(row.messages ?? []), ...context, version: row.version, updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at) };
  }

  async save(state: Omit<PersistedThreadState, 'version' | 'updatedAt'>): Promise<void> {
    const messages = minimizeThreadMessages(state.messages);
    const context = { lastRagUsed: state.lastRagUsed, sourceReferences: state.sourceReferences };
    await this.db.query(
      `INSERT INTO agent_thread_state (thread_id, messages, context)
       VALUES ($1, $2::jsonb, $3::jsonb)
       ON CONFLICT (thread_id) DO UPDATE SET
         messages = EXCLUDED.messages, context = EXCLUDED.context,
         version = agent_thread_state.version + 1, updated_at = now()`,
      [state.threadId, JSON.stringify(messages), JSON.stringify(context)]
    );
  }

  async reset(threadId: string): Promise<void> {
    await this.db.query('DELETE FROM agent_thread_state WHERE thread_id = $1', [threadId]);
  }
}
