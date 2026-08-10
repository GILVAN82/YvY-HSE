import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { attachmentConfig } from './attachment.config';
import { parseAttachment } from './attachment.parser';
import { safeDisplayName, validateFileType } from './attachment.validation';
import { AttachmentError, type AttachmentMetadata, type NormalizedAttachment } from './attachment.types';

interface Stored { metadata: AttachmentMetadata; path: string; parsed: Omit<NormalizedAttachment, keyof AttachmentMetadata | 'data'> }

function terms(text: string) { return new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((word) => word.length > 2)); }

export class TemporaryAttachmentService {
  private readonly records = new Map<string, Stored>();
  private initialized = false;
  constructor(private readonly config = attachmentConfig) {}

  async initialize() { if (this.initialized) return; await mkdir(this.config.directory, { recursive: true }); await this.cleanupExpired(true); this.initialized = true; }

  async create(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, threadId: string): Promise<AttachmentMetadata> {
    await this.initialize();
    if (file.size > this.config.maxFileBytes) throw new AttachmentError('ATTACHMENT_TOO_LARGE', 'The attachment exceeds the configured file-size limit.');
    const active = [...this.records.values()].filter((record) => record.metadata.threadId === threadId && Date.parse(record.metadata.expiresAt) > Date.now());
    if (active.length >= this.config.maxPerThread) throw new AttachmentError('TOO_MANY_ATTACHMENTS', 'This conversation already has the maximum number of attachments.');
    if (active.reduce((sum, record) => sum + record.metadata.size, 0) + file.size > this.config.maxCombinedBytes) throw new AttachmentError('ATTACHMENT_TOO_LARGE', 'The combined attachment-size limit has been exceeded.');
    const filename = safeDisplayName(file.originalname);
    const { kind, mimeType } = validateFileType(filename, file.mimetype, file.buffer);
    const parsed = await parseAttachment(kind, mimeType, file.buffer);
    const attachmentId = randomUUID(); const now = new Date();
    const metadata: AttachmentMetadata = { attachmentId, filename, kind, mimeType, size: file.size, threadId, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + this.config.ttlMinutes * 60_000).toISOString() };
    const storagePath = path.join(this.config.directory, attachmentId);
    await writeFile(storagePath, file.buffer, { flag: 'wx' });
    this.records.set(attachmentId, { metadata, path: storagePath, parsed: parsed as any });
    return metadata;
  }

  async resolve(ids: string[], threadId: string): Promise<NormalizedAttachment[]> {
    const results: NormalizedAttachment[] = [];
    for (const id of ids) {
      const record = this.records.get(id);
      if (!record) throw new AttachmentError('ATTACHMENT_NOT_FOUND', 'The attachment was not found.');
      if (Date.parse(record.metadata.expiresAt) <= Date.now()) { await this.removeRecord(id, record); throw new AttachmentError('ATTACHMENT_EXPIRED', 'The attachment has expired.'); }
      if (record.metadata.threadId !== threadId) throw new AttachmentError('ATTACHMENT_WRONG_THREAD', 'The attachment is not available in this conversation.');
      if (record.metadata.kind === 'image') results.push({ ...record.metadata, kind: 'image', data: await readFile(record.path) });
      else results.push({ ...record.metadata, ...record.parsed } as NormalizedAttachment);
    }
    return results;
  }

  buildContext(attachments: NormalizedAttachment[], question: string): string {
    const query = terms(question); const sections: Array<{ score: number; text: string }> = [];
    for (const item of attachments) {
      if (item.kind === 'document') for (const section of item.sections) {
        const citation = `[Attachment: ${item.filename}${section.page ? `, page ${section.page}` : ''}]`;
        sections.push({ score: [...terms(section.text)].filter((term) => query.has(term)).length, text: `${citation}\n${section.text}` });
      }
      if (item.kind === 'spreadsheet') for (const sheet of item.sheets) for (const row of sheet.rows) {
        const text = `[Attachment: ${item.filename}, sheet: ${sheet.name}, row ${row.row}]\n${Object.entries(row.values).map(([key, value]) => `${key}: ${value ?? ''}`).join('; ')}`;
        sections.push({ score: [...terms(text)].filter((term) => query.has(term)).length, text });
      }
      if (item.kind === 'image') sections.push({ score: 100, text: `[Attachment: ${item.filename}] (image supplied as temporary visual input)` });
    }
    return sections.sort((a,b) => b.score-a.score).map((item) => item.text).join('\n\n').slice(0, this.config.maxContextChars);
  }

  async remove(id: string, threadId: string) { const record = this.records.get(id); if (!record) throw new AttachmentError('ATTACHMENT_NOT_FOUND', 'The attachment was not found.'); if (record.metadata.threadId !== threadId) throw new AttachmentError('ATTACHMENT_WRONG_THREAD', 'The attachment is not available in this conversation.'); await this.removeRecord(id, record); }
  async cleanupExpired(includeOrphans = false) {
    for (const [id, record] of this.records) if (Date.parse(record.metadata.expiresAt) <= Date.now()) await this.removeRecord(id, record);
    if (includeOrphans) for (const name of await readdir(this.config.directory)) if (!this.records.has(name) && /^[0-9a-f-]{36}$/i.test(name)) await rm(path.join(this.config.directory, name), { force: true });
  }
  private async removeRecord(id: string, record: Stored) { this.records.delete(id); await rm(record.path, { force: true }); }
}

export const temporaryAttachmentService = new TemporaryAttachmentService();
export const attachmentCleanupTimer = setInterval(() => temporaryAttachmentService.cleanupExpired().catch(() => undefined), attachmentConfig.cleanupIntervalMs).unref();
