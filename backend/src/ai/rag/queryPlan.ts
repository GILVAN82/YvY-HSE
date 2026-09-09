import { z } from 'zod';
import { ReformulationError } from './errors';
export const RetrievalQueryPlanSchema = z.object({
  originalQuery: z.string().min(1).max(500), semanticQuery: z.string().min(1).max(500),
  lexicalQuery: z.string().min(1).max(500), exactTerms: z.array(z.string()).max(50),
  acronyms: z.array(z.string()).max(50), jurisdiction: z.string().optional(), domain: z.string().optional(),
}).strict();
export type RetrievalQueryPlan = z.infer<typeof RetrievalQueryPlanSchema>;
export type QueryPlanner = (query: string) => Promise<RetrievalQueryPlan>;
export const deterministicQueryPlan: QueryPlanner = async originalQuery => ({
  originalQuery, semanticQuery: originalQuery, lexicalQuery: originalQuery,
  exactTerms: [...new Set(originalQuery.match(/\b(?:[A-Z][A-Z0-9]*[-.]\d[\w.-]*|\d+(?:[.-]\d+)+)\b/g) ?? [])],
  acronyms: [...new Set(originalQuery.match(/\b[A-Z]{2,}\b/g) ?? [])],
});
export async function prepareQuery(query: string, planner: QueryPlanner = deterministicQueryPlan) {
  try {
    const parsed = RetrievalQueryPlanSchema.safeParse(await planner(query));
    if (!parsed.success || parsed.data.originalQuery !== query) throw new ReformulationError('Invalid query plan');
    return { plan: parsed.data, reformulationStatus: 'DETERMINISTIC' as const };
  } catch (error) {
    if (!(error instanceof ReformulationError)) throw error;
    return { plan: { originalQuery: query, semanticQuery: query, lexicalQuery: query, exactTerms: [] as string[], acronyms: [] as string[] },
      reformulationStatus: 'FALLBACK_ORIGINAL' as const };
  }
}

const STOP = new Set('a an the how what should be is are for of to and in on do does when can explain describe please apply applied use used'.split(' '));
export function lexicalTerms(query: string): string[] {
  return [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+(?:[-.][\p{L}\p{N}]+)*/gu) ?? [])
    .filter(t => t.length > 1 && !STOP.has(t)))];
}
export function lexicalCoverage(query: string, content: string): number {
  const terms = lexicalTerms(query), words = new Set(lexicalTerms(content));
  return terms.length ? terms.filter(t => words.has(t)).length / terms.length : 0;
}
