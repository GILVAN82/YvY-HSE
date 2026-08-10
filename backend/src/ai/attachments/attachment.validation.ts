import path from 'node:path';
import type { AttachmentKind } from './attachment.types';
import { AttachmentError } from './attachment.types';

const EXTENSIONS = new Set(['.pdf', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp']);
const BLOCKED = new Set(['.exe', '.js', '.ps1', '.bat', '.cmd', '.zip', '.rar', '.7z', '.doc', '.docm', '.xlsm']);

export function safeDisplayName(input: string): string {
  const base = path.basename(input.replace(/\\/g, '/')).replace(/[\u0000-\u001f<>:"|?*]/g, '_').trim();
  return (base || 'attachment').slice(0, 160);
}

function isZip(bytes: Buffer) { return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]); }

export function validateFileType(filename: string, declaredMime: string, bytes: Buffer): { kind: AttachmentKind; mimeType: string } {
  const ext = path.extname(filename).toLowerCase();
  if (BLOCKED.has(ext)) {
    if (ext === '.doc') throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'Legacy .doc files are not supported. Please save the file as .docx.');
    throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'This file type is not supported.');
  }
  if (!EXTENSIONS.has(ext)) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'This file type is not supported.');
  if (ext === '.pdf') {
    if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The file content does not match its PDF extension.');
    if (declaredMime.startsWith('image/')) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The declared MIME type does not match the PDF.');
    return { kind: 'document', mimeType: 'application/pdf' };
  }
  if (ext === '.docx') {
    if (!isZip(bytes)) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The file content does not match its DOCX extension.');
    if (declaredMime.startsWith('image/')) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The declared MIME type does not match the DOCX file.');
    return { kind: 'document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  if (ext === '.xlsx') {
    if (!isZip(bytes)) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The file content does not match its XLSX extension.');
    if (declaredMime.startsWith('image/')) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The declared MIME type does not match the XLSX file.');
    return { kind: 'spreadsheet', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
  if (ext === '.xls') {
    throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'Legacy .xls files are not supported securely. Please save the file as .xlsx.');
  }
  const image = ext === '.png'
    ? bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
    : ext === '.webp'
      ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!image) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The file content does not match its image extension.');
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  if (declaredMime && !declaredMime.startsWith('image/')) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'The declared MIME type does not match the image.');
  return { kind: 'image', mimeType };
}
