import { pool } from '../db/pool';
import { computeKpi } from '../routes/kpi';
import { readOrchestrator } from './config';
import { resolveModel } from './providers';
import { runHseAgent } from './graph/hseAgent.runner';
import { runLegacyAgent } from './legacyRunner';
import { PostgresThreadStateStore } from './graph/threadState.repository';
import { PostgresMemoryRepository } from './memory/memory.repository';
import { ControlledMemoryService } from './memory/memory.service';
import { PostgresApprovalService } from './hitl/hitl.repository';
import { OpenAIEmbeddingService } from './rag/embedding.service';
import { PostgresRagRetrievalRepository } from './rag/retrieval.repository';
import { RagRetrievalService } from './rag/retrieval.service';
import { createHseTools } from './tools';
import { temporaryAttachmentService } from './attachments/attachment.service';
import type { AiChatDependencies } from '../routes/aiChat';

export interface ProductionAiComposition {
  aiChatDependencies: AiChatDependencies;
  threadStateStore: PostgresThreadStateStore;
  longTermMemoryService: ControlledMemoryService;
  humanApprovalService: PostgresApprovalService;
  ragRetriever: RagRetrievalService;
}

/** Production-only composition root. Importing reusable agent or router modules does not create database dependencies. */
export function createProductionAiComposition(): ProductionAiComposition {
  const threadStateStore = new PostgresThreadStateStore(pool);
  const memoryRepository = new PostgresMemoryRepository(pool);
  const longTermMemoryService = new ControlledMemoryService(memoryRepository);
  const humanApprovalService = new PostgresApprovalService(pool);
  const embeddings = new OpenAIEmbeddingService();
  const ragRepository = new PostgresRagRetrievalRepository(pool);
  const ragRetriever = new RagRetrievalService(embeddings, ragRepository);
  const toolFactory = (allowMemoryWrite: boolean) => createHseTools(pool, computeKpi, ragRetriever, longTermMemoryService, allowMemoryWrite);

  const aiChatDependencies: AiChatDependencies = {
    resolveModel,
    readOrchestrator,
    runHseAgent,
    runLegacyAgent,
    threadStateStore,
    longTermMemoryService,
    humanApprovalService,
    toolFactory,
    attachmentService: temporaryAttachmentService,
  };
  return { aiChatDependencies, threadStateStore, longTermMemoryService, humanApprovalService, ragRetriever };
}

export function createProductionAiDependencies(): AiChatDependencies {
  return createProductionAiComposition().aiChatDependencies;
}
