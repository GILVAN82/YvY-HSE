import { createHash } from 'node:crypto';
import type { MemoryRepository } from './memory.repository';
import { MEMORY_CATEGORIES, type LongTermMemory, type MemoryService, type SaveMemoryCandidate, type SaveMemoryResult } from './memory.types';

export const MAX_MEMORY_CONTENT_LENGTH = 500;
export const MAX_ACTIVE_MEMORIES = 50;
export const MAX_RETRIEVED_MEMORIES = 3;

function hasExplicitSaveMemoryIntent(text: string): boolean {
  return /\b(remember that|remember this|save this preference|save this for future|use this in future conversations|lembre(?:-se)? (?:de )?que|guarde (?:isto|esta preferência)|use isto em conversas futuras|recuerda que|recuerde que|guarda esto|guarde esto|usa esto en futuras conversaciones)\b/i.test(text);
}

export type ExplicitMemoryIntent = 'SAVE' | 'UPDATE' | 'FORGET' | null;

export function classifyExplicitMemoryIntent(text: string): ExplicitMemoryIntent {
  if (/\b(forget that|forget this|remove that memory|remove this memory|delete that memory|delete this memory|esqueca (?:essa|esta|aquela)|remova (?:essa|esta|aquela) memoria|apague (?:essa|esta|aquela) memoria)\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return 'FORGET';
  if (/\b(update that memory|update this memory|atualize (?:essa|esta|aquela) memoria)\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return 'UPDATE';
  return hasExplicitSaveMemoryIntent(text) ? 'SAVE' : null;
}

export function hasExplicitMemoryIntent(text: string): boolean {
  return classifyExplicitMemoryIntent(text) !== null;
}

export type MemorySafetyRejection = 'SECRET_OR_CREDENTIAL' | 'SENSITIVE_PERSONAL_DATA' | null;

/** Classifies an explicit memory request without returning or transforming its content. */
export function classifyMemorySafetyRejection(text: string): MemorySafetyRejection {
  if (!hasExplicitMemoryIntent(text)) return null;
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(?:api[_ -]?key|password|passwd|secret|access[_ -]?token|token|database_url|credential|senha|chave de api|clave de api|contrasena|credencial)\b/i.test(normalized) || /postgres(?:ql)?:\/\//i.test(normalized)) return 'SECRET_OR_CREDENTIAL';
  if (/\b(?:medical|diagnosis|patient|worker name|employee id|health record|investigation witness|dados medicos|diagnostico|nome do trabalhador|datos medicos|nombre del trabajador)\b/i.test(normalized)) return 'SENSITIVE_PERSONAL_DATA';
  return null;
}

export function normalizeMemoryContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

export function validateMemoryCandidate(candidate: SaveMemoryCandidate): string | null {
  const content = normalizeMemoryContent(candidate.content);
  if (!MEMORY_CATEGORIES.includes(candidate.category)) return 'CATEGORY_NOT_ALLOWED';
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(candidate.memoryKey)) return 'INVALID_MEMORY_KEY';
  if (!content || content.length > MAX_MEMORY_CONTENT_LENGTH) return 'INVALID_CONTENT_SIZE';
  if (/\b(?:api[_ -]?key|password|passwd|secret|token|database_url|credential|senha|chave de api)\b/i.test(content) || /postgres(?:ql)?:\/\//i.test(content)) return 'SECRET_OR_CREDENTIAL';
  if (/\b(?:medical|diagnosis|patient|worker name|employee id|health record|investigation witness|dados médicos|diagnóstico|nome do trabalhador)\b/i.test(content)) return 'SENSITIVE_PERSONAL_DATA';
  if (/\b(?:incident|permit|ptw|action)\s*(?:#|id|number|n[ºo.]?)?\s*\d+\b/i.test(content)) return 'TRANSIENT_OPERATIONAL_RECORD';
  if (/ignore (?:all |any )?(?:previous|system) instructions|system prompt|override (?:the )?(?:rules|policy)/i.test(content)) return 'PROMPT_INJECTION_CONTENT';
  return null;
}

function tokens(text: string): Set<string> {
  const stopwords = new Set(['the', 'this', 'that', 'use', 'uses', 'for', 'which', 'should', 'project', 'uma', 'para', 'que', 'este', 'esta', 'usar']);
  const aliases: Record<string, string> = { banco: 'database', dados: 'database', db: 'database', persistencia: 'persistence', postgres: 'postgresql' };
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return new Set(normalized.replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((word) => word.length >= 2 && !stopwords.has(word)).map((word) => aliases[word] ?? word));
}

export class ControlledMemoryService implements MemoryService {
  constructor(private readonly repository: MemoryRepository) {}
  async save(candidate: SaveMemoryCandidate): Promise<SaveMemoryResult> {
    const reason = validateMemoryCandidate(candidate); if (reason) return { status: 'REJECTED', reason };
    const content = normalizeMemoryContent(candidate.content);
    const hash = createHash('sha256').update(content.toLowerCase()).digest('hex');
    const duplicate = await this.repository.findByHash(candidate.category, hash);
    if (duplicate) return { status: 'UNCHANGED', memory: duplicate };
    const existing = await this.repository.findByKey(candidate.memoryKey);
    if (existing && !candidate.update) return { status: 'CONFLICT', reason: 'EXPLICIT_UPDATE_REQUIRED' };
    if (existing) return { status: 'UPDATED', memory: await this.repository.update(candidate.memoryKey, candidate.category, content, hash) };
    if (await this.repository.countActive() >= MAX_ACTIVE_MEMORIES) return { status: 'REJECTED', reason: 'ACTIVE_MEMORY_LIMIT' };
    return { status: 'CREATED', memory: await this.repository.create(candidate.memoryKey, candidate.category, content, hash) };
  }
  async retrieveRelevant(query: string): Promise<LongTermMemory[]> {
    const queryTokens = tokens(query); if (!queryTokens.size) return [];
    const candidates = await this.repository.listActive(MAX_ACTIVE_MEMORIES);
    const ranked = candidates.map((memory) => ({ memory, score: [...tokens(`${memory.memoryKey} ${memory.category} ${memory.content}`)].filter((token) => queryTokens.has(token)).length }))
      .filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.memory.memoryKey.localeCompare(b.memory.memoryKey)).slice(0, MAX_RETRIEVED_MEMORIES).map((item) => item.memory);
    await this.repository.touch(ranked.map((memory) => memory.id)); return ranked;
  }
  forget(memoryKey: string) { return this.repository.disable(memoryKey); }
}
