import { z } from 'zod';

/** Additive, numeric-only UI facts. Never transport rows, identities or raw arguments. */
export const operationalPresentationFactsSchema = z.object({
  recordCount: z.number().int().nonnegative().optional(),
  pendingCount: z.number().int().nonnegative().optional(),
  openCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
  countIsLowerBound: z.boolean().optional(),
  metrics: z.object({ trir: z.number().nonnegative().optional(), ltifr: z.number().nonnegative().optional(), daysSinceLTI: z.number().int().nonnegative().optional() }).optional(),
});
export type OperationalPresentationFacts = z.infer<typeof operationalPresentationFactsSchema>;

export function operationalPresentationFacts(tool: string, output: unknown, args?: Record<string, unknown>): OperationalPresentationFacts | undefined {
  if (!output || typeof output !== 'object') return undefined;
  const value = output as Record<string, unknown>;
  if (value.error || !['SUCCESS_WITH_DATA', 'SUCCESS_NO_DATA'].includes(String(value.status))) return undefined;
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : undefined;
  const facts: OperationalPresentationFacts = { recordCount: count(value.recordCount) };
  if (tool === 'list_actions') {
    if (args?.open === true || args?.overdue === true) facts.pendingCount = facts.recordCount;
    if (facts.recordCount !== undefined && typeof args?.limit === 'number' && facts.recordCount >= args.limit) facts.countIsLowerBound = true;
  }
  if (tool === 'list_incidents') {
    const summary = value.summary as Record<string, unknown> | undefined;
    facts.openCount = count(summary?.openCount) ?? (args?.open === true ? facts.recordCount : undefined);
    facts.totalCount = count(summary?.totalCount);
    if (count(summary?.openCount) === undefined && facts.openCount !== undefined && typeof args?.limit === 'number' && facts.openCount >= args.limit) facts.countIsLowerBound = true;
  }
  if (tool === 'get_kpi' && value.status === 'SUCCESS_WITH_DATA') {
    const data = value.data as Record<string, unknown> | undefined;
    const metric = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
    facts.metrics = { trir: metric(data?.trir), ltifr: metric(data?.ltifr), daysSinceLTI: count(data?.daysSinceLTI) };
  }
  return facts;
}
