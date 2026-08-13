export type AttachmentKind = 'document' | 'spreadsheet' | 'image';

export interface AttachmentMetadata {
  attachmentId: string;
  filename: string;
  kind: AttachmentKind;
  mimeType: string;
  size: number;
  threadId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface AttachmentSection { page?: number; heading?: string; text: string }
export interface AttachmentRow { row: number; values: Record<string, string | number | boolean | null> }
export interface AttachmentSheet { name: string; rows: AttachmentRow[] }

export type NormalizedAttachment =
  | (AttachmentMetadata & { kind: 'document'; sections: AttachmentSection[] })
  | (AttachmentMetadata & { kind: 'spreadsheet'; sheets: AttachmentSheet[] })
  | (AttachmentMetadata & { kind: 'image'; data: Buffer });

export type AttachmentErrorCode =
  | 'ATTACHMENT_TOO_LARGE' | 'TOO_MANY_ATTACHMENTS' | 'UNSUPPORTED_FILE_TYPE'
  | 'CORRUPTED_FILE' | 'ENCRYPTED_FILE' | 'ATTACHMENT_EXPIRED'
  | 'ATTACHMENT_NOT_FOUND' | 'ATTACHMENT_WRONG_THREAD' | 'ATTACHMENT_PARSE_FAILED';

export class AttachmentError extends Error {
  constructor(public readonly code: AttachmentErrorCode, message: string) { super(message); }
}
