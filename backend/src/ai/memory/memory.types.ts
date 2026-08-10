export const MEMORY_CATEGORIES = ['WORKFLOW_PREFERENCE', 'PROJECT_CONTEXT', 'OPERATING_CONSTRAINT', 'DOMAIN_PREFERENCE'] as const;
export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

export interface LongTermMemory {
  id: string;
  memoryKey: string;
  category: MemoryCategory;
  content: string;
}

export interface SaveMemoryCandidate {
  memoryKey: string;
  category: MemoryCategory;
  content: string;
  update?: boolean;
}

export type SaveMemoryResult =
  | { status: 'CREATED' | 'UPDATED' | 'UNCHANGED'; memory: LongTermMemory }
  | { status: 'REJECTED'; reason: string }
  | { status: 'CONFLICT'; reason: string };

export interface MemoryService {
  save(candidate: SaveMemoryCandidate): Promise<SaveMemoryResult>;
  retrieveRelevant(query: string): Promise<LongTermMemory[]>;
  forget(memoryKey: string): Promise<boolean>;
}
