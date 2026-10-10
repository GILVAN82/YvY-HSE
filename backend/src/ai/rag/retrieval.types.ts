export interface RagEvidence {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  semanticRank?: number;
  lexicalRank?: number;
  fusionScore?: number;
  sourceId: string;
  title: string;
  module: string;
  version: string;
  citationLabel: string;
  sourceOrganization: string;
  jurisdiction: string;
  sourceUrl: string;
}

export type RetrievalDiagnostics = {
  retrievalMode: 'HYBRID' | 'SEMANTIC_ONLY' | 'LEXICAL_FALLBACK';
  relevanceState: 'RELEVANT_EVIDENCE' | 'NO_RELEVANT_EVIDENCE' | 'RETRIEVAL_UNAVAILABLE' | 'LEXICAL_FALLBACK' | 'PARTIAL_REQUIRED_EVIDENCE';
  reformulationStatus: 'DETERMINISTIC' | 'FALLBACK_ORIGINAL';
  configFingerprint: string;
};
export type RagRetrievalResult = (
  | { status: 'OK'; evidence: RagEvidence[] }
  | { status: 'NO_RELEVANT_EVIDENCE'; evidence: [] }
  | { status: 'NOT_APPROPRIATE'; evidence: []; reason: 'STRUCTURED_OPERATIONAL_QUERY' }
  | { status: 'RETRIEVAL_UNAVAILABLE' | 'PARTIAL_REQUIRED_EVIDENCE'; evidence: [] }
) & { diagnostics?: RetrievalDiagnostics };

export interface RagRetriever {
  retrieve(query: string): Promise<RagRetrievalResult>;
}
