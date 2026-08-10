import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { AttachmentKind, AttachmentRow, AttachmentSection, AttachmentSheet } from './attachment.types';
import { AttachmentError } from './attachment.types';

export async function parseAttachment(kind: AttachmentKind, mimeType: string, bytes: Buffer): Promise<{ sections?: AttachmentSection[]; sheets?: AttachmentSheet[] }> {
  try {
    if (kind === 'image') return {};
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        const sections = result.pages.map((page) => ({ page: page.num, text: page.text.trim() })).filter((page) => page.text);
        if (!sections.length) throw new AttachmentError('CORRUPTED_FILE', 'This PDF appears to contain scanned pages without extractable text. Upload the relevant page as an image for visual analysis.');
        return { sections };
      } finally { await parser.destroy(); }
    }
    if (mimeType.includes('openxmlformats')) {
      const archive = await JSZip.loadAsync(bytes);
      const expandedBytes = Object.values(archive.files).reduce((total, entry: any) => total + Number(entry?._data?.uncompressedSize ?? 0), 0);
      if (expandedBytes > 40 * 1024 * 1024) throw new AttachmentError('ATTACHMENT_TOO_LARGE', 'The expanded Office document exceeds the safe processing limit.');
      if (Object.keys(archive.files).some((name) => /vbaProject\.bin|macros?/i.test(name))) throw new AttachmentError('UNSUPPORTED_FILE_TYPE', 'Macro-enabled Office files are not supported.');
    }
    if (kind === 'document') {
      const result = await mammoth.extractRawText({ buffer: bytes });
      const sections = result.value.split(/\n\s*\n/).map((text) => ({ text: text.trim() })).filter((section) => section.text);
      if (!sections.length) throw new AttachmentError('CORRUPTED_FILE', 'The DOCX file contains no usable text.');
      return { sections };
    }
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as any);
    const display = (value: ExcelJS.CellValue): string | number | boolean | null => {
      if (value == null) return null;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object' && 'formula' in value) return (value as ExcelJS.CellFormulaValue).result == null ? '[formula not evaluated]' : String((value as ExcelJS.CellFormulaValue).result);
      if (typeof value === 'object' && 'text' in value) return String((value as any).text);
      return String(value);
    };
    const sheets: AttachmentSheet[] = workbook.worksheets.map((sheet) => {
      const headers = Array.from({ length: sheet.columnCount }, (_, index) => String(display(sheet.getRow(1).getCell(index + 1).value) ?? `Column ${index + 1}`));
      const rows: AttachmentRow[] = [];
      for (let rowNumber = 2; rowNumber <= Math.min(sheet.rowCount, 501); rowNumber++) rows.push({ row: rowNumber, values: Object.fromEntries(headers.map((header, column) => [header, display(sheet.getRow(rowNumber).getCell(column + 1).value)])) });
      return { name: sheet.name, rows };
    });
    return { sheets };
  } catch (error: any) {
    if (error instanceof AttachmentError) throw error;
    const message = String(error?.message ?? '');
    if (/password|encrypted/i.test(message)) throw new AttachmentError('ENCRYPTED_FILE', 'Encrypted or password-protected files are not supported.');
    throw new AttachmentError('CORRUPTED_FILE', 'The attachment could not be safely parsed.');
  }
}
