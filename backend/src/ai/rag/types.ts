export type Sensitivity = 'public-reference' | 'internal-sensitive' | 'restricted';

export type RagSourceDocument = {
  sourceType: string;
  sourceReference: string;
  module: string;
  title: string;
  version: string;
  content: string;
  sensitivity: Sensitivity;
  metadata?: Readonly<{
    language?: string;
    citationLabel?: string;
    sourcePath?: string;
    effectiveDate?: string;
    revisionDate?: string;
    sourceOrganization?: string;
    jurisdiction?: string;
    sourceUrl?: string;
    secondarySourceUrl?: string;
    contentStatus?: string;
    accessedOn?: string;
    ingestionFingerprint?: string;
  }>;
};

export type PreparedRagChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Readonly<Record<string, string | number | boolean>>;
};

export type EmbeddedRagChunk = PreparedRagChunk & { embedding: number[] };

export type StoredRagDocument = {
  id: string;
  sourceType: string;
  sourceReference: string;
  version: string;
  contentHash: string;
  ingestionFingerprint?: string;
};

export type RagSourceDefinition = {
  sourceId: string;
  sourceType: string;
  module: string;
  title: string;
  version: string;
  sensitivity: Sensitivity;
  enabled: boolean;
  filePath: string;
  citationLabel: string;
  language?: string;
  effectiveDate?: string;
  revisionDate?: string;
  sourceOrganization: string;
  jurisdiction: string;
  sourceUrl: string;
  secondarySourceUrl?: string;
  contentStatus: 'curated_summary_not_official_text';
  accessedOn?: string;
};

export type IngestionError = { sourceReference: string; message: string };

export type IngestionSummary = {
  corpus?: ReturnType<typeof import('./identity').corpusFingerprint>;
  dryRun: boolean;
  sourcesExamined: number;
  sourcesExcluded: number;
  documentsCreated: number;
  documentsUpdated: number;
  documentsSkipped: number;
  chunksCreated: number;
  embeddingsCreated: number;
  warnings: string[];
  errors: IngestionError[];
  documents: Array<{
    title: string;
    module: string;
    sourceReference: string;
    sensitivity: Sensitivity;
    normalizedCharacters: number;
    chunks: number;
    contentHash: string;
    version: string;
    citationLabel?: string;
    sourceOrganization?: string;
    jurisdiction?: string;
  }>;
};
