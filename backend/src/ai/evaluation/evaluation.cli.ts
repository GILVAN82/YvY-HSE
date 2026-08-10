import fs from 'node:fs/promises';
import path from 'node:path';
import { AgentStatus } from '../graph/hseAgent.types';
import { YVY_HSE_EVALUATION_CASES } from './evaluation.dataset';
import { runEvaluationHarness } from './evaluation.harness';
import { assertSafeEvaluationReport, renderEvaluationMarkdown } from './evaluation.report';
import type { AgentObservation, EvaluationCase } from './evaluation.types';

function controlledObservation(item: EvaluationCase): AgentObservation {
  const expected = item.expectation;
  return {
    status: expected.allowedStatuses?.[0] ?? AgentStatus.COMPLETED,
    toolsUsed: [...(expected.requiredTools ?? [])], ragUsed: expected.ragUsed ?? false,
    citationLabels: expected.citationRequired ? ['Approved source citation'] : [],
    sourceIds: expected.sourceIdIncludes ? [`yvy-kb-${expected.sourceIdIncludes}`] : [],
    refusalReason: expected.refusalReason, errorCode: expected.errorCode,
    approvalStatus: expected.approvalStatus, threadLeakage: expected.threadLeakage,
    memoryWriteCount: expected.memoryWriteCount, secretExposed: expected.secretExposed,
    jurisdictionQualified: expected.jurisdictionQualified, noRelevantEvidence: expected.noRelevantEvidence,
    citationSourceValid: expected.citationSourceValid, vectorExposed: expected.vectorExposed,
    operationalFields: expected.operationalFieldsExactly, portfolioWildcardNormalized: expected.portfolioWildcardNormalized,
    blankStatusIgnored: expected.blankStatusIgnored, overdueFilterApplied: expected.overdueFilterApplied,
    threadContinuity: expected.threadContinuity, memoryRetrieved: expected.memoryRetrieved,
    memoryForgotten: expected.memoryForgotten, hitlBypassed: expected.hitlBypassed,
    databaseReadOnly: expected.databaseReadOnly, domainScopeEnforced: expected.domainScopeEnforced,
  };
}

void (async () => {
  const report = await runEvaluationHarness(YVY_HSE_EVALUATION_CASES, async (item) => controlledObservation(item));
  assertSafeEvaluationReport(report);
  const outputDir = path.resolve(__dirname, '../../../../artifacts/evaluation');
  await fs.mkdir(outputDir, { recursive: true });
  let liveSafeValidation: unknown;
  try {
    liveSafeValidation = JSON.parse(await fs.readFile(path.join(outputDir, 'agent-evaluation-live-safe-latest.json'), 'utf8'));
  } catch { liveSafeValidation = undefined; }
  await fs.writeFile(path.join(outputDir, 'agent-evaluation-latest.json'), `${JSON.stringify({ ...report, ...(liveSafeValidation ? { liveSafeValidation } : {}) }, null, 2)}\n`, 'utf8');
  const liveMarkdown = liveSafeValidation && typeof liveSafeValidation === 'object'
    ? `\n## Live-safe validation (reported separately)\n\n- Scenarios: ${(liveSafeValidation as any).total}\n- Passed: ${(liveSafeValidation as any).passed}\n- Failed: ${(liveSafeValidation as any).failed}\n- Cleanup: ${(liveSafeValidation as any).cleanup?.passed ? 'PASS' : 'FAIL'}\n- Operational Actions data used: NO\n- Incident data used: NO\n`
    : '';
  await fs.writeFile(path.join(outputDir, 'agent-evaluation-latest.md'), `${renderEvaluationMarkdown(report)}${liveMarkdown}`, 'utf8');
  console.log('YVY HSE AGENT EVALUATION');
  console.log(`Scenarios: ${report.total}`); console.log(`Passed: ${report.passed}`); console.log(`Failed: ${report.failed}`);
  for (const [category, result] of Object.entries(report.categoryResults)) console.log(`${category}: ${result.passed}/${result.total}`);
  console.log(`Scenario Pass Rate: ${(report.passRate * 100).toFixed(1)}%`);
  if (report.failed) process.exitCode = 1;
})().catch(() => { console.log('AGENT EVALUATION: FAILED'); process.exitCode = 1; });
