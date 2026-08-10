import type { EvaluationReport } from './evaluation.types';

export function renderEvaluationMarkdown(report: EvaluationReport): string {
  const categories = Object.entries(report.categoryResults).map(([name, value]) => `| ${name} | ${value.passed}/${value.total} |`).join('\n');
  const failures = report.results.filter((result) => !result.passed).map((result) => `- ${result.caseId}: ${result.checks.filter((check) => !check.passed).map((check) => check.name).join(', ')}`).join('\n') || '- None';
  return `# YVY HSE Agent Evaluation\n\n- Execution mode: ${report.executionMode}\n- Scenarios: ${report.total}\n- Passed: ${report.passed}\n- Failed: ${report.failed}\n- Scenario pass rate: ${(report.passRate * 100).toFixed(1)}%\n\n## Category results\n\n| Category | Result |\n|---|---:|\n${categories}\n\n## Failures\n\n${failures}\n\n## Interpretation\n\nDeterministic observable-behavior regression result; this is not “AI accuracy”. Reports exclude raw responses, prompts, vectors, secrets, and operational payloads.\n`;
}

export function assertSafeEvaluationReport(report: EvaluationReport): void {
  const serialized = JSON.stringify(report);
  if (/sk-[a-z0-9]|DATABASE_URL|system prompt contents|embedding\s*:\s*\[/i.test(serialized)) throw new Error('Evaluation report contains prohibited private material');
}
