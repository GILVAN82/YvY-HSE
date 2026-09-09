import { isJurisdictionClaim, jurisdictionSupportsClaim } from './jurisdiction.contract';
import {
  EvidenceSourceType,
  VerificationStatus,
  type AgentEvidence,
  type VerificationResult,
} from './evidence.contract';

const OPERATIONAL_TERMS = /\b(?:kpi|trir|ltifr|safety performance|desempenho de seguranca|incident|incidente|action|a[cç][aã]o|project|projeto|permit|ptw|audit|training|record|registro|overdue|atrasad|vencid|open|closed|active|portfolio|portf[oó]lio)\w*/i;
const SAFETY_TERMS = /\b(?:loto|lockout|tagout|isolation|zero energy|permit[- ]to[- ]work|ptw|risk assessment|emergency procedure|safety procedure|procedimento de seguran[cç]a|avalia[cç][aã]o de risco)\b/i;
const SOURCE_ASSERTION = /\b(?:requires?|states?|guidance|procedure|must|shall|deve|exige|orienta[cç][aã]o|procedimento)\b/i;
const NO_DATA_LANGUAGE = /\b(?:no|none|zero|0|nenhum[ao]?|n[aã]o (?:h[aá]|foram encontrados?)|without any)\b/i;
const POSITIVE_DATA_LANGUAGE = /\b(?:there (?:is|are)|found|has|have|exist|total|contains?|available|há|existem?|foram encontrados?|tem|possui|dispon[ií]vel)\b/i;
const HITL_MISREPRESENTATION = /\b(?:loto|lockout|tagout)\b.*\b(?:is|was|foi|est[aá])\s+(?:approved|authorized|completed|executed|safe|aprovad[oa]|autorizad[oa]|conclu[ií]d[oa]|executad[oa]|segur[oa])\b|\b(?:approved|authorized|completed|executed|aprovad[oa]|autorizad[oa]|conclu[ií]d[oa]|executad[oa])\b.*\b(?:physical|field|equipment|loto|f[ií]sic[oa]|campo|equipamento)\b/i;
const STOPWORDS = new Set(['the','and','that','this','with','from','have','has','are','was','for','into','must','should','there','requires','states','guidance','procedure','verification','loto','uma','para','com','que','deve','sao','esta','esse','essa','como','por','los','las','con','pour','avec','dans']);

type ClaimKind = 'OPERATIONAL' | 'RAG_SAFETY';
interface Claim { text: string; kind: ClaimKind; }

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
}

function claimsRequiringEvidence(text: string, hasRagEvidence: boolean): Claim[] {
  const claims: Claim[] = [];
  for (const sentence of sentences(text)) {
    const safety = isJurisdictionClaim(sentence) || (SAFETY_TERMS.test(sentence) && (SOURCE_ASSERTION.test(sentence) || /\[[^\]]+\]/.test(sentence)))
      || (hasRagEvidence && sentence.split(/\s+/).length >= 2);
    const operational = OPERATIONAL_TERMS.test(sentence) && (/\d/.test(sentence) || NO_DATA_LANGUAGE.test(sentence) || POSITIVE_DATA_LANGUAGE.test(sentence));
    if (safety) claims.push({ text: sentence, kind: 'RAG_SAFETY' });
    else if (operational) {
      const clauses = sentence.split(/\s*(?:[;,]|\b(?:and|also|e|tamb[eé]m|y|et|und)\b)\s*/i).filter(Boolean);
      for (const clause of clauses) {
        if (OPERATIONAL_TERMS.test(clause) && (/\d/.test(clause) || NO_DATA_LANGUAGE.test(clause) || POSITIVE_DATA_LANGUAGE.test(clause))) claims.push({ text: clause, kind: 'OPERATIONAL' });
      }
    }
  }
  return claims;
}

function numbers(text: string): number[] {
  return [...text.matchAll(/(?<![A-Za-z])\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(',', '.'))).filter(Number.isFinite);
}

// Dates and record identifiers are values, not bags of independent numbers.
const DATE_TOKEN = /\b(?:\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?|\d{1,2}[/.]\d{1,2}[/.]\d{4})\b/g;
const ID_TOKEN = /\b[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*\b/g;
const ID_FIELD = /(?:Id|_id|Code|_code)$/i;

function calendarDate(value: string): string | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(value);
  if (!iso && !local) return undefined;
  const [year, month, day] = iso ? [+iso[1], +iso[2], +iso[3]] : [+local![3], +local![2], +local![1]];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function structuredClaim(claim: string, evidence: AgentEvidence[]) {
  let text = claim.replace(/^\s*\d+[.)]\s+/, ''); // Markdown list position is not an operational quantity.
  const dates = [...text.matchAll(DATE_TOKEN)].map(match => match[0]);
  text = text.replace(DATE_TOKEN, ' ');
  const identifiers = [...text.matchAll(ID_TOKEN)].map(match => match[0]).filter(value => /\d/.test(value));
  const allFacts = evidence.flatMap(item => (item.facts ?? []).map(fact => ({ ...fact, evidenceId: item.id })));
  const idFacts = allFacts.filter(fact => ID_FIELD.test(fact.path.split('.').at(-1) ?? '') && typeof fact.value === 'string');
  const matched = identifiers.flatMap(value => idFacts.filter(fact => fact.value === value));
  const unknownId = identifiers.find(value => !idFacts.some(fact => fact.value === value));
  if (unknownId) return { text, reason: `Operational identifier is not present in current tool evidence (${unknownId}).` };
  text = text.replace(ID_TOKEN, value => identifiers.includes(value) ? ' ' : value);
  // When one record is named, its dates must come from that record, not another row.
  const facts = identifiers.length === 1 ? allFacts.filter(fact => matched.some(id =>
    id.evidenceId === fact.evidenceId && id.path.replace(/\.[^.]+$/, '') === fact.path.replace(/\.[^.]+$/, '')
  )) : allFacts;
  for (const value of dates) {
    const normalized = calendarDate(value);
    const supported = normalized && facts.some(fact => typeof fact.value === 'string' &&
      (/T/.test(value) ? fact.value === value : calendarDate(fact.value) === normalized));
    if (!supported) return { text, reason: `Operational date is not present in current record evidence (${value}).` };
  }
  return { text, reason: undefined };
}

function normalizedTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\[[^\]]+\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token)));
}

function ragSupportsClaim(claim: string, evidence: AgentEvidence): boolean {
  if (!evidence.rag) return false;
  const claimTokens = normalizedTokens(claim);
  const evidenceTokens = normalizedTokens(evidence.rag.content);
  const overlap = [...claimTokens].filter((token) => evidenceTokens.has(token)).length;
  const required = claimTokens.size <= 5 ? 1 : 2;
  return overlap >= required;
}

function operationalCheck(claim: string, evidence: AgentEvidence[]): { supported: boolean; contradicted: boolean; reason?: string } {
  const allTools = evidence.filter((item) => item.sourceType === EvidenceSourceType.TOOL);
  const normalized = claim.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const expectedTool = /\b(actions?|acoes?|acao|capa|tasks?)\b/.test(normalized) ? 'list_actions'
    : /\b(incidents?|incidentes?|accidents?|ocorrencias?)\b/.test(normalized) ? 'list_incidents'
    : /\b(kpi|trir|ltifr|safety performance|desempenho|indicadores?)\b/.test(normalized) ? 'get_kpi'
    : /\b(permits?|ptw|permissoes?)\b/.test(normalized) ? '__unsupported_operational_capability__'
    : undefined;
  const tools = expectedTool ? allTools.filter((item) => item.toolName === expectedTool) : allTools;
  if (!tools.length) return { supported: false, contradicted: false, reason: 'Operational claim has no current tool evidence.' };
  if (tools.every((item) => item.resultStatus === 'ERROR')) return { supported: false, contradicted: true, reason: 'Operational claim relies on a failed tool result.' };
  const successful = tools.filter((item) => item.resultStatus !== 'ERROR');
  const noData = successful.length > 0 && successful.every((item) => item.resultStatus === 'SUCCESS_NO_DATA' || item.recordCount === 0);
  const structured = structuredClaim(claim, successful);
  if (structured.reason) return { supported: false, contradicted: true, reason: structured.reason };
  const claimNumbers = numbers(structured.text);
  if (noData) {
    const claimsPositive = claimNumbers.some((value) => value > 0) || (POSITIVE_DATA_LANGUAGE.test(claim) && !NO_DATA_LANGUAGE.test(claim));
    return claimsPositive
      ? { supported: false, contradicted: true, reason: 'Response claims records exist, but the tool returned SUCCESS_NO_DATA.' }
      : { supported: NO_DATA_LANGUAGE.test(claim) || claimNumbers.includes(0), contradicted: false, reason: 'Zero-result wording must explicitly report no records or zero.' };
  }
  if (!claimNumbers.length) return { supported: true, contradicted: false };
  const supportedNumbers = new Set(successful.flatMap((item) => [item.recordCount, ...(item.facts ?? []).filter((fact) => typeof fact.value === 'number').map((fact) => fact.value as number)]).filter((value): value is number => typeof value === 'number'));
  const unsupported = claimNumbers.filter((value) => !supportedNumbers.has(value));
  return unsupported.length
    ? { supported: false, contradicted: true, reason: `Operational numeric claim is not present in current tool evidence (${unsupported.join(', ')}).` }
    : { supported: true, contradicted: false };
}

function ragCheck(claim: string, evidence: AgentEvidence[]): { supported: boolean; contradicted: boolean; reason?: string } {
  const citations = [...claim.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
  const rag = evidence.filter((item) => item.sourceType === EvidenceSourceType.RAG && item.rag);
  if (!rag.length) return { supported: false, contradicted: false, reason: 'Safety or procedural claim has no approved RAG evidence.' };
  if (!citations.length) return { supported: false, contradicted: false, reason: 'Safety or procedural claim is missing a citation to retrieved evidence.' };
  const cited = rag.filter((item) => citations.includes(item.rag!.citationLabel));
  if (!cited.length) return { supported: false, contradicted: true, reason: 'Citation does not correspond to a source retrieved in this run.' };
  if(isJurisdictionClaim(claim)&&!cited.some(item=>jurisdictionSupportsClaim(claim,item)))return {supported:false,contradicted:true,reason:'Jurisdiction claim is not supported by the cited source jurisdiction and content.'};
  return cited.some((item) => jurisdictionSupportsClaim(claim,item) && ragSupportsClaim(claim, item))
    ? { supported: true, contradicted: false }
    : { supported: false, contradicted: false, reason: 'Retrieved source does not contain sufficient lexical support for the safety claim.' };
}

export function verifyEvidenceContract(finalText: string, evidence: AgentEvidence[]): VerificationResult {
  const claims = claimsRequiringEvidence(finalText, evidence.some((item) => item.sourceType === EvidenceSourceType.RAG));
  const reasons: string[] = [];
  let verifiedClaims = 0;
  let unsupportedClaims = 0;
  let contradicted = false;
  let safetyBlocked = HITL_MISREPRESENTATION.test(finalText);
  if (safetyBlocked) reasons.push('Response misrepresents LOTO approval, physical execution, or field safety state.');

  for (const claim of claims) {
    const result = claim.kind === 'OPERATIONAL' ? operationalCheck(claim.text, evidence) : ragCheck(claim.text, evidence);
    if (result.supported) verifiedClaims += 1;
    else {
      unsupportedClaims += 1;
      contradicted ||= result.contradicted;
      safetyBlocked ||= claim.kind === 'RAG_SAFETY';
      if (result.reason && !reasons.includes(result.reason)) reasons.push(result.reason);
    }
  }

  const status = safetyBlocked ? VerificationStatus.SAFETY_BLOCKED
    : contradicted ? VerificationStatus.CONTRADICTED
    : unsupportedClaims && verifiedClaims ? VerificationStatus.PARTIALLY_VERIFIED
    : unsupportedClaims ? VerificationStatus.INSUFFICIENT_EVIDENCE
    : VerificationStatus.VERIFIED;
  return {
    status,
    claimsConsidered: claims.length,
    verifiedClaims,
    unsupportedClaims,
    evidenceItemsConsidered: evidence.length,
    evidenceSourceTypes: [...new Set(evidence.map((item) => item.sourceType))],
    sources: [...new Set(evidence.map((item) => item.source))],
    reasons,
  };
}
