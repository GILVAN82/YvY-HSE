export interface RagEvidence {
  chunkId: string;
  documentId: string;
  content: string;
  score: number;
  sourceId: string;
  title: string;
  module: string;
  version: string;
  citationLabel: string;
  sourceOrganization: string;
  jurisdiction: string;
  sourceUrl: string;
}

export type RagRetrievalResult =
  | { status: 'OK'; evidence: RagEvidence[] }
  | { status: 'NO_RELEVANT_EVIDENCE'; evidence: [] }
  | { status: 'NOT_APPROPRIATE'; evidence: []; reason: 'STRUCTURED_OPERATIONAL_QUERY' };

export interface RagRetriever {
  retrieve(query: string): Promise<RagRetrievalResult>;
}
