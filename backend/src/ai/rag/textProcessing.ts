import { createHash } from 'node:crypto';
import type { PreparedRagChunk } from './types';

export const TOKEN_ESTIMATE_METHOD = 'estimated:ceil(characters/4)';
export const DEFAULT_CHUNK_OPTIONS = Object.freeze({ targetTokens: 750, maxTokens: 1000, overlapTokens: 100 });

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

function splitOversized(text: string, maxChars: number, overlapChars: number): string[] {
  const words = text.split(' ');
  const parts: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }
    parts.push(current);
    const overlap = current.slice(-overlapChars).replace(/^\S*\s/, '');
    current = overlap ? `${overlap} ${word}` : word;
  }
  if (current) parts.push(current);
  return parts;
}

export function chunkContent(
  normalizedContent: string,
  options = DEFAULT_CHUNK_OPTIONS
): PreparedRagChunk[] {
  if (!normalizedContent) return [];
  if (estimateTokens(normalizedContent) <= options.maxTokens) {
    return [{ chunkIndex: 0, content: normalizedContent, tokenCount: estimateTokens(normalizedContent), metadata: { tokenCountMethod: TOKEN_ESTIMATE_METHOD } }];
  }

  const targetChars = options.targetTokens * 4;
  const maxChars = options.maxTokens * 4;
  const overlapChars = options.overlapTokens * 4;
  const paragraphs = normalizedContent.split(/\n\n+/).flatMap((paragraph) =>
    paragraph.length > maxChars ? splitOversized(paragraph, maxChars, overlapChars) : [paragraph]
  );
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= targetChars || !current) current = candidate;
    else {
      chunks.push(current);
      const overlap = current.slice(-overlapChars).replace(/^\S*\s/, '').trim();
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((content, chunkIndex) => ({
    chunkIndex,
    content,
    tokenCount: estimateTokens(content),
    metadata: { tokenCountMethod: TOKEN_ESTIMATE_METHOD },
  }));
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
