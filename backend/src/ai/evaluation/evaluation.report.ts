import type { EvaluationReport } from './evaluation.types';

export function renderEvaluationMarkdown(report: EvaluationReport): string {
  const categories = Object.entries(report.categoryResults).map(([name, value]) => `| ${name} | ${value.passed}/${value.total} |`).join('\n');
  const metrics = Object.entries(report.metrics).map(([name,value])=>`| ${name} | ${value.passed}/${value.total} | ${value.percentage===null?'N/A':value.percentage.toFixed(1)+'%'} |`).join('\n');
  const failures = report.results.filter((result) => !result.passed).map((result) => `- ${result.caseId}: ${result.checks.filter((check) => !check.passed).map((check) => check.name).join(', ')}`).join('\n') || '- None';
  return `# YVY HSE Agent Evaluation\n\n- Execution mode: ${report.executionMode}\n- Model mode: ${report.provenance?.modelMode??'EXECUTOR_DEFINED'}\n- Commit: ${report.provenance?.gitCommit??'not retained'}\n- Source fingerprint: ${report.provenance?.sourceFingerprint??'not retained'}\n- Dirty working tree: ${report.provenance?.workingTreeDirty??'unknown'}\n- Scenarios: ${report.total}\n- Passed: ${report.passed}\n- Failed: ${report.failed}\n- Scenario pass rate: ${(report.passRate * 100).toFixed(1)}%\n\n## Metrics\n\n| Metric | Result | Check pass rate |\n|---|---:|---:|\n${metrics}\n\n## Category results\n\n| Category | Result |\n|---|---:|\n${categories}\n\n## Failures\n\n${failures}\n\n## Interpretation\n\nDeterministic observable-behavior regression using synthetic fixtures and mock models; this is not live-provider performance or benchmark-grade model accuracy. Synthetic retrieval does not measure real corpus recall, provider latency or linguistic quality. Required source checks require every named source; relevant source checks accept alternatives. Case IDs select independent fixtures, never expected outcomes. Reports exclude raw responses, prompts, vectors, secrets, and operational payloads.\n`;
}

export function assertSafeEvaluationReport(report: EvaluationReport): void {
  const serialized = JSON.stringify(report);
  if (/sk-[a-z0-9]|DATABASE_URL|system prompt contents|embedding\s*:\s*\[/i.test(serialized)) throw new Error('Evaluation report contains prohibited private material');
}
