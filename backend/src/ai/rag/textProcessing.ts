import { RetrievalConfigError } from './errors';
import { createHash } from 'node:crypto';
import type { PreparedRagChunk } from './types';

export const TOKEN_ESTIMATE_METHOD = 'estimated:ceil(characters/4)';
export type ChunkOptions = { targetTokens: number; maxTokens: number; overlapTokens: number };
export const DEFAULT_CHUNK_OPTIONS: Readonly<ChunkOptions> = Object.freeze({ targetTokens: 750, maxTokens: 1000, overlapTokens: 100 });

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function normalizeContent(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function contentHash(normalizedContent: string): string {
  return createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
}

/** Canonical UTF-16 windows. Offsets allow exact reconstruction, including whitespace.
 * The bound is the declared character-based estimate, not a provider tokenizer. */
export function chunkContent(normalizedContent: string, options = DEFAULT_CHUNK_OPTIONS): PreparedRagChunk[] {
  const { targetTokens, maxTokens, overlapTokens } = options;
  if (![targetTokens, maxTokens, overlapTokens].every(Number.isInteger) ||
      targetTokens < 1 || maxTokens < targetTokens || overlapTokens < 0 || overlapTokens >= targetTokens) {
    throw new RetrievalConfigError('Invalid chunk configuration');
  }
  const chunks: PreparedRagChunk[] = [];
  let start = 0;
  while (start < normalizedContent.length) {
    let end = Math.min(normalizedContent.length, start + (normalizedContent.length - start <= maxTokens * 4 ? maxTokens : targetTokens) * 4);
    // Never separate a UTF-16 surrogate pair.
    if (end < normalizedContent.length && /[\uD800-\uDBFF]/.test(normalizedContent[end - 1])) end--;
    const content = normalizedContent.slice(start, end);
    chunks.push({ chunkIndex: chunks.length, content, tokenCount: estimateTokens(content),
      metadata: { tokenCountMethod: TOKEN_ESTIMATE_METHOD, startOffset: start, endOffset: end, chunkingVersion: 'windows-v2' } });
    if (end === normalizedContent.length) break;
    let next = end - overlapTokens * 4;
    if (/[\uDC00-\uDFFF]/.test(normalizedContent[next])) next--;
    start = Math.max(start + 1, next);
  }
  return chunks;
}

const SUSPICIOUS_PATTERNS = [
  /ignore (all |the )?(previous|prior) instructions/i,
  /system prompt/i,
  /developer message/i,
  /reveal (the )?(secret|secrets|credentials|api key)/i,
  /execute (this |the )?(command|shell)/i,
];

export function detectSuspiciousInstructions(content: string): string[] {
  return SUSPICIOUS_PATTERNS.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
}
