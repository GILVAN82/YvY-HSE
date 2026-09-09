import type { RagEvidence } from './retrieval.types';
import { RetrievalConfigError } from './errors';
export type FusedEvidence = RagEvidence & { semanticRank?: number; lexicalRank?: number; fusionScore: number };
/** Each retriever contributes at most once per chunk. Scores are never added. */
export function reciprocalRankFusion(semantic: RagEvidence[], lexical: RagEvidence[], k: number): FusedEvidence[] {
  if (!Number.isInteger(k) || k < 1) throw new RetrievalConfigError('Invalid RRF k');
  const results = new Map<string, FusedEvidence>();
  for (const [items, field] of [[semantic, 'semanticRank'], [lexical, 'lexicalRank']] as const) {
    const seen = new Set<string>();
    let rank = 0;
    for (const item of items) {
      const key = `${item.documentId}:${item.chunkId}`;
      if (seen.has(key)) continue;
      seen.add(key); rank++;
      const current = results.get(key) ?? { ...item, fusionScore: 0 };
      current[field] = rank;
      current.fusionScore += 1 / (k + rank);
      results.set(key, current);
    }
  }
  return [...results.values()].sort((a, b) => b.fusionScore - a.fusionScore ||
    a.documentId.localeCompare(b.documentId, 'en') || a.chunkId.localeCompare(b.chunkId, 'en'));
}
