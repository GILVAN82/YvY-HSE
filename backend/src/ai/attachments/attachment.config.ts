import path from 'node:path';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const attachmentConfig = {
  directory: path.resolve(__dirname, '../../../.tmp/ai-attachments'),
  ttlMinutes: positiveInt(process.env.AI_ATTACHMENT_TTL_MINUTES, 120),
  maxFileBytes: positiveInt(process.env.AI_ATTACHMENT_MAX_FILE_MB, 10) * 1024 * 1024,
  maxPerThread: positiveInt(process.env.AI_ATTACHMENT_MAX_PER_THREAD, 3),
  maxCombinedBytes: positiveInt(process.env.AI_ATTACHMENT_MAX_COMBINED_MB, 25) * 1024 * 1024,
  cleanupIntervalMs: positiveInt(process.env.AI_ATTACHMENT_CLEANUP_MINUTES, 15) * 60 * 1000,
  maxContextChars: positiveInt(process.env.AI_ATTACHMENT_MAX_CONTEXT_CHARS, 16000),
};
