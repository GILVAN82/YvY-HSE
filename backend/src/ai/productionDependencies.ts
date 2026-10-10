import { PostgresAttentionReader } from './attention/attention-explanation';
import { pool } from '../db/pool';
import { computeKpi } from '../routes/kpi.service';
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
import type { RequestPrincipal } from '../auth/auth.types';

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
  const memoryServiceFactory=(userId:string)=>new ControlledMemoryService(memoryRepository,userId);
  const toolFactory=(allowMemoryWrite:boolean,principal?:RequestPrincipal)=>{
    const memory=principal?memoryServiceFactory(principal.userId):longTermMemoryService;
    const scopedKpi=(project:string,month:number|undefined)=>computeKpi(project,month,principal,pool);
    return createHseTools(pool,scopedKpi,ragRetriever,memory,allowMemoryWrite,principal);
  };

  const aiChatDependencies: AiChatDependencies = {
    attentionReader: new PostgresAttentionReader(pool,humanApprovalService),
    attentionRag: ragRetriever,
    resolveModel,
    readOrchestrator,
    runHseAgent,
    runLegacyAgent,
    threadStateStore,
    longTermMemoryService,
    memoryServiceFactory,
    humanApprovalService,
    toolFactory,
    attachmentService: temporaryAttachmentService,
  };
  return { aiChatDependencies, threadStateStore, longTermMemoryService, humanApprovalService, ragRetriever };
}

export function createProductionAiDependencies(): AiChatDependencies {
  return createProductionAiComposition().aiChatDependencies;
}
