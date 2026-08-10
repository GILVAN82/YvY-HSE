import fs from 'node:fs/promises';
import path from 'node:path';
import type { RagSourceDefinition, RagSourceDocument } from './types';
import { detectSuspiciousInstructions, normalizeContent } from './textProcessing';

/**
 * Only these explicitly reviewed files are eligible. Ingestion never crawls files or database
 * tables; an unregistered file in knowledge/approved remains inert.
 */
export const RAG_SOURCE_REGISTRY: readonly RagSourceDefinition[] = Object.freeze([
  {
    sourceId: 'yvy-kb-loto-osha-1910-147',
    title: 'Control of Hazardous Energy (Lockout/Tagout) - Curated Reference Summary',
    module: 'LOTO', sourceType: 'regulatory_reference_summary', version: 'YvY-curated-summary-v1.0',
    filePath: '01_loto_osha.md', sensitivity: 'public-reference', enabled: true,
    citationLabel: 'OSHA 29 CFR 1910.147 - LOTO',
    sourceOrganization: 'Occupational Safety and Health Administration (OSHA)',
    jurisdiction: 'United States - Federal General Industry',
    sourceUrl: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.147',
    secondarySourceUrl: 'https://www.osha.gov/etools/lockout-tagout/hot-topics/energy-control-program/training-retraining',
    contentStatus: 'curated_summary_not_official_text', accessedOn: '2026-08-08', language: 'en',
  },
  {
    sourceId: 'yvy-kb-ptw-hse-hsg250',
    title: 'Permit-to-Work Systems - Curated Reference Summary',
    module: 'Permit to Work', sourceType: 'official_guidance_summary', version: 'YvY-curated-summary-v1.0',
    filePath: '02_permit_to_work_hse.md', sensitivity: 'public-reference', enabled: true,
    citationLabel: 'HSE HSG250 - Permit-to-Work Systems',
    sourceOrganization: 'UK Health and Safety Executive (HSE)', jurisdiction: 'United Kingdom',
    sourceUrl: 'https://www.hse.gov.uk/pubns/books/hsg250.htm',
    secondarySourceUrl: 'https://www.hse.gov.uk/coshh/basics/permits.htm',
    contentStatus: 'curated_summary_not_official_text', accessedOn: '2026-08-08', language: 'en',
  },
  {
    sourceId: 'yvy-kb-risk-assessment-hse',
    title: 'Managing Risks and Risk Assessment at Work - Curated Reference Summary',
    module: 'HIRA / Risk Assessment', sourceType: 'official_guidance_summary', version: 'YvY-curated-summary-v1.0',
    filePath: '03_risk_assessment_hse.md', sensitivity: 'public-reference', enabled: true,
    citationLabel: 'HSE - Managing Risks and Risk Assessment at Work',
    sourceOrganization: 'UK Health and Safety Executive (HSE)', jurisdiction: 'United Kingdom',
    sourceUrl: 'https://www.hse.gov.uk/risk/',
    secondarySourceUrl: 'https://www.hse.gov.uk/simple-health-safety/risk/steps-needed-to-manage-risk.htm',
    contentStatus: 'curated_summary_not_official_text', accessedOn: '2026-08-08', language: 'en',
  },
  {
    sourceId: 'yvy-kb-emergency-procedures-hse',
    title: 'Emergency Procedures - Curated Reference Summary',
    module: 'Emergency Preparedness and Response', sourceType: 'official_guidance_summary', version: 'YvY-curated-summary-v1.0',
    filePath: '04_emergency_procedures_hse.md', sensitivity: 'public-reference', enabled: true,
    citationLabel: 'HSE - Emergency Procedures',
    sourceOrganization: 'UK Health and Safety Executive (HSE)', jurisdiction: 'United Kingdom',
    sourceUrl: 'https://www.hse.gov.uk/workplace-health/emergency-procedures.htm',
    contentStatus: 'curated_summary_not_official_text', accessedOn: '2026-08-08', language: 'en',
  },
]);

export const APPROVED_KNOWLEDGE_ROOT = path.resolve(__dirname, '../../../../knowledge/approved');
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt']);

export type ExcludedSource = {
  sourceReference: string;
  classification: 'TOOL_SQL' | 'PROMPT' | 'DO_NOT_EXPOSE' | 'MISSING_DOCUMENT';
  reason: string;
};

export const EXCLUDED_SOURCE_REGISTRY: readonly ExcludedSource[] = Object.freeze([
  { sourceReference: 'tableMeta.json:descriptions', classification: 'PROMPT', reason: 'UI guidance is small enough for prompt context and is not HSE knowledge.' },
  { sourceReference: 'emergency_preparedness', classification: 'DO_NOT_EXPOSE', reason: 'Contact records include names and phone numbers.' },
  { sourceReference: 'emergency_response_plan_summary', classification: 'TOOL_SQL', reason: 'Six structured scenario rows; referenced ERP documents are not present.' },
  { sourceReference: 'emergency_drill_register', classification: 'TOOL_SQL', reason: 'Operational drill record.' },
  { sourceReference: 'hira_register', classification: 'TOOL_SQL', reason: 'Structured risk assessment record with personal owner fields.' },
  { sourceReference: 'jsa_log_and_steps', classification: 'TOOL_SQL', reason: 'Structured operational analysis with preparer/approver fields.' },
  { sourceReference: 'incident_register', classification: 'DO_NOT_EXPOSE', reason: 'Operational incidents include personal and medical fields.' },
  { sourceReference: 'investigation_rca', classification: 'DO_NOT_EXPOSE', reason: 'Currently empty; future investigations may contain personal/confidential details.' },
  { sourceReference: 'action_tracker_capa', classification: 'TOOL_SQL', reason: 'Structured actions with responsible and verifier identities.' },
  { sourceReference: 'safety_observations_bbs', classification: 'DO_NOT_EXPOSE', reason: 'Operational observations include observer and observed-person fields.' },
  { sourceReference: 'toolbox_talks', classification: 'TOOL_SQL', reason: 'Attendance/briefing operational record, not a procedure body.' },
  { sourceReference: 'meeting_minutes', classification: 'DO_NOT_EXPOSE', reason: 'Operational record includes attendee identities.' },
  { sourceReference: 'management_of_change', classification: 'TOOL_SQL', reason: 'Structured change record with initiator/approver identities.' },
  { sourceReference: 'spill_environmental_incident', classification: 'TOOL_SQL', reason: 'Structured operational incident record.' },
  { sourceReference: 'chemical_inventory_msds', classification: 'MISSING_DOCUMENT', reason: 'MSDS status exists, but no SDS/MSDS body is stored.' },
  { sourceReference: 'legal_compliance_and_audits', classification: 'TOOL_SQL', reason: 'Structured status/references; normative and audit document bodies are absent.' },
  { sourceReference: 'document_control', classification: 'MISSING_DOCUMENT', reason: 'Document metadata exists, but controlled document bodies are absent.' },
  { sourceReference: 'change_log', classification: 'TOOL_SQL', reason: 'Structured workbook history record.' },
]);

export const SENSITIVE_SOURCE_GROUPS_EXCLUDED = 9;

export type SourceReview = {
  approved: RagSourceDocument[];
  excluded: Array<{ sourceId: string; reason: string }>;
  invalid: Array<{ sourceId: string; reason: string }>;
  sensitive: Array<{ sourceId: string; reason: string }>;
  promptInjectionWarnings: Array<{ sourceId: string; matches: number }>;
};

const SECRET_PATTERNS = [
  /\b(?:password|api[_ -]?key|secret|token)\s*[:=]\s*\S+/i,
  /\b[A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY)[A-Z0-9_]*\s*=/,
  /\b(?:postgres(?:ql)?|mysql):\/\/[^\s]+/i,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
];
const PERSONAL_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:phone|telephone|mobile|worker name|injured person|medical)\s*[:=]/i,
  /(?:\+\d[\d ()-]{7,}\d)/,
];

function required(value: string | undefined, field: string) {
  if (!value?.trim()) throw new Error(`${field} is required`);
}

function resolveRegisteredPath(root: string, filePath: string): string {
  required(filePath, 'filePath');
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, filePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('filePath must stay inside the approved knowledge directory');
  }
  if (!ALLOWED_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
    throw new Error('only .md and .txt sources are supported');
  }
  return resolved;
}

function validateDefinition(source: RagSourceDefinition) {
  required(source.sourceId, 'sourceId');
  required(source.sourceType, 'sourceType');
  required(source.module, 'module');
  required(source.title, 'title');
  required(source.version, 'version');
  required(source.citationLabel, 'citationLabel');
  required(source.sensitivity, 'sensitivity');
  required(source.sourceOrganization, 'sourceOrganization');
  required(source.jurisdiction, 'jurisdiction');
  required(source.sourceUrl, 'sourceUrl');
  required(source.contentStatus, 'contentStatus');
}

export async function reviewRegisteredSources(
  registry: readonly RagSourceDefinition[] = RAG_SOURCE_REGISTRY,
  root = APPROVED_KNOWLEDGE_ROOT
): Promise<SourceReview> {
  const review: SourceReview = { approved: [], excluded: [], invalid: [], sensitive: [], promptInjectionWarnings: [] };
  const seen = new Set<string>();
  for (const source of registry) {
    const displayId = source.sourceId?.trim() || '(missing source ID)';
    if (!source.enabled) { review.excluded.push({ sourceId: displayId, reason: 'disabled in registry' }); continue; }
    try {
      validateDefinition(source);
      if (seen.has(source.sourceId)) throw new Error('sourceId must be unique');
      seen.add(source.sourceId);
      if (source.sensitivity !== 'public-reference') {
        review.sensitive.push({ sourceId: source.sourceId, reason: `sensitivity ${source.sensitivity} is not eligible` });
        continue;
      }
      const absolutePath = resolveRegisteredPath(root, source.filePath);
      const raw = await fs.readFile(absolutePath, 'utf8');
      const content = normalizeContent(raw);
      if (!content) throw new Error('source content is empty');
      const sensitivePattern = [...SECRET_PATTERNS, ...PERSONAL_PATTERNS].find((pattern) => pattern.test(content));
      if (sensitivePattern) {
        review.sensitive.push({ sourceId: source.sourceId, reason: 'suspected personal information or secret detected' });
        continue;
      }
      const suspicious = detectSuspiciousInstructions(content);
      if (suspicious.length) review.promptInjectionWarnings.push({ sourceId: source.sourceId, matches: suspicious.length });
      review.approved.push({
        sourceType: source.sourceType,
        sourceReference: source.sourceId,
        module: source.module,
        title: source.title,
        version: source.version,
        content,
        sensitivity: source.sensitivity,
        metadata: {
          citationLabel: source.citationLabel,
          sourcePath: source.filePath.replace(/\\/g, '/'),
          ...(source.language ? { language: source.language } : {}),
          ...(source.effectiveDate ? { effectiveDate: source.effectiveDate } : {}),
          ...(source.revisionDate ? { revisionDate: source.revisionDate } : {}),
          sourceOrganization: source.sourceOrganization,
          jurisdiction: source.jurisdiction,
          sourceUrl: source.sourceUrl,
          ...(source.secondarySourceUrl ? { secondarySourceUrl: source.secondarySourceUrl } : {}),
          contentStatus: source.contentStatus,
          ...(source.accessedOn ? { accessedOn: source.accessedOn } : {}),
        },
      });
    } catch (error) {
      review.invalid.push({ sourceId: displayId, reason: error instanceof Error ? error.message : 'invalid source' });
    }
  }
  return review;
}

export async function loadApprovedSources(
  registry: readonly RagSourceDefinition[] = RAG_SOURCE_REGISTRY,
  root = APPROVED_KNOWLEDGE_ROOT
) {
  const review = await reviewRegisteredSources(registry, root);
  if (review.invalid.length || review.sensitive.length) {
    throw new Error(`Source validation failed: ${review.invalid.length} invalid, ${review.sensitive.length} sensitive`);
  }
  return review.approved;
}
