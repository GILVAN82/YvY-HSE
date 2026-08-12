import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { listProvidersForClient, ProviderUnavailableError } from '../ai/providers';
import { MAX_MESSAGE_LENGTH, MAX_HISTORY_TURNS } from '../ai/config';
import { resumeHumanApproval, runHseAgent } from '../ai/graph/hseAgent.runner';
import { AgentErrorCode, type AgentEvent } from '../ai/graph/hseAgent.types';
import { ApprovalResolutionError } from '../ai/hitl/hitl.repository';
import type { LanguageModel, ToolSet } from 'ai';
import type { ThreadStateStore } from '../ai/graph/threadState.repository';
import type { MemoryService } from '../ai/memory/memory.types';
import type { ApprovalService } from '../ai/hitl/hitl.types';
import multer from 'multer';
import { attachmentConfig } from '../ai/attachments/attachment.config';
import { AttachmentError } from '../ai/attachments/attachment.types';
import type { TemporaryAttachmentService } from '../ai/attachments/attachment.service';

export interface AiChatDependencies {
  resolveModel: (provider: string, model: string) => LanguageModel;
  readOrchestrator: () => 'legacy' | 'langgraph';
  runHseAgent: typeof runHseAgent;
  runLegacyAgent: (input: Parameters<typeof import('../ai/legacyRunner').runLegacyAgent>[0]) => ReturnType<typeof import('../ai/legacyRunner').runLegacyAgent>;
  threadStateStore: ThreadStateStore;
  longTermMemoryService: MemoryService;
  humanApprovalService: ApprovalService;
  tools?: ToolSet;
  toolFactory?: (allowMemoryWrite: boolean) => ToolSet;
  attachmentService: TemporaryAttachmentService;
}
// Basic abuse protection. This is a local, single-user app today, but the chat endpoint
// calls billed third-party APIs, so a stuck frontend loop or a stray script should not be
// able to run up an unbounded bill.
/** Request contract. Validated before anything reaches the model. */
const chatRequestSchema = z.object({
  message: z.string().min(1, 'message is required').max(MAX_MESSAGE_LENGTH),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .max(MAX_HISTORY_TURNS * 2)
    .optional(),
  conversationId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  provider: z.string().min(1, 'provider is required'),
  model: z.string().min(1, 'model is required'),
  attachmentIds: z.array(z.string().uuid()).max(3).optional(),
  locale: z.enum(['en', 'pt', 'es', 'fr', 'de']).optional(),
});

const approvalDecisionSchema = z.object({
  threadId: z.string().uuid(),
  resolutionNote: z.string().trim().max(500).optional(),
  locale: z.enum(['en', 'pt', 'es', 'fr', 'de']).optional(),
});

export function createAiChatRouter(dependencies: AiChatDependencies) {
const router = Router();
const chatLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: attachmentConfig.maxFileBytes, files: 1 } });

const sendAttachmentError = (res: Response, error: unknown) => {
  if (error instanceof AttachmentError) return res.status(error.code === 'ATTACHMENT_WRONG_THREAD' ? 403 : error.code === 'ATTACHMENT_NOT_FOUND' ? 404 : 400).json({ code: error.code, error: error.message });
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ code: 'ATTACHMENT_TOO_LARGE', error: 'The attachment exceeds the configured file-size limit.' });
  return res.status(400).json({ code: 'ATTACHMENT_PARSE_FAILED', error: 'The attachment could not be processed.' });
};

const receiveAttachment: import('express').RequestHandler = (req, res, next) => upload.single('file')(req, res, (error) => error ? void sendAttachmentError(res, error) : next());

router.post('/ai/attachments', receiveAttachment, async (req: Request, res: Response) => {
  try {
    const threadId = z.string().uuid().parse(req.body?.threadId);
    if (!req.file) throw new AttachmentError('ATTACHMENT_NOT_FOUND', 'No attachment was supplied.');
    const metadata = await dependencies.attachmentService.create(req.file, threadId);
    const { attachmentId, filename, kind, mimeType, size, expiresAt } = metadata;
    res.status(201).json({ attachmentId, filename, kind, mimeType, size, expiresAt });
  } catch (error) { sendAttachmentError(res, error); }
});

router.delete('/ai/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const attachmentId = z.string().uuid().parse(req.params.attachmentId);
    const threadId = z.string().uuid().parse(req.query.threadId);
    await dependencies.attachmentService.remove(attachmentId, threadId);
    res.status(204).end();
  } catch (error) { sendAttachmentError(res, error); }
});

// GET /api/ai/providers -> which providers/models are usable, WITHOUT ever exposing API keys.
router.get('/ai/providers', (_req: Request, res: Response) => {
  res.json(listProvidersForClient());
});

const resolveApproval = (decision: 'APPROVE' | 'REJECT'): import('express').RequestHandler => async (req, res) => {
  const approvalId = z.string().uuid().safeParse(req.params.approvalId);
  const body = approvalDecisionSchema.safeParse(req.body);
  if (!approvalId.success || !body.success) {
    res.status(400).json({ error: 'Invalid approval request.', code: 'AI_INVALID_APPROVAL_REQUEST' });
    return;
  }
  try {
    const result = await resumeHumanApproval({
      approvalId: approvalId.data, threadId: body.data.threadId, decision,
      resolutionNote: body.data.resolutionNote, locale: body.data.locale,
      approvalService: dependencies.humanApprovalService, threadStore: dependencies.threadStateStore,
    });
    res.json({ approval: result.approval, text: result.text });
  } catch (error) {
    if (error instanceof ApprovalResolutionError) {
      res.status(409).json({ error: 'Approval is unavailable or no longer pending for this thread.', code: 'AI_APPROVAL_NOT_PENDING' });
      return;
    }
    res.status(500).json({ error: 'The approval decision could not be recorded.', code: 'AI_APPROVAL_RESOLUTION_FAILED' });
  }
};

router.post('/ai/approvals/:approvalId/approve', resolveApproval('APPROVE'));
router.post('/ai/approvals/:approvalId/reject', resolveApproval('REJECT'));

router.post('/ai/chat', chatLimiter, async (req: Request, res: Response) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? 'Invalid request',
      code: 'AI_INVALID_REQUEST',
    });
    return;
  }
  const { message, history, conversationId, threadId, provider, model, attachmentIds = [], locale } = parsed.data;
  if (threadId && conversationId && threadId !== conversationId) {
    res.status(400).json({ error: 'threadId and conversationId must match', code: 'AI_INVALID_THREAD' });
    return;
  }
  if (attachmentIds.length && !threadId) {
    res.status(400).json({ error: 'threadId is required when attachments are used', code: 'AI_INVALID_THREAD' });
    return;
  }

  let attachments = [] as Awaited<ReturnType<TemporaryAttachmentService['resolve']>>;
  try { if (attachmentIds.length) attachments = await dependencies.attachmentService.resolve(attachmentIds, threadId!); }
  catch (error) { sendAttachmentError(res, error); return; }
  const attachmentContext = attachments.length ? dependencies.attachmentService.buildContext(attachments, message) : undefined;

  let languageModel;
  try {
    languageModel = dependencies.resolveModel(provider, model);
  } catch (err: any) {
    // A provider with no key configured is a server-side gap, not a bad request:
    // 503 so the client can tell "you asked wrong" from "the server cannot serve this".
    if (err instanceof ProviderUnavailableError) {
      res.status(503).json({ error: err.message, code: AgentErrorCode.PROVIDER_UNAVAILABLE });
      return;
    }
    res.status(400).json({ error: err.message, code: 'AI_INVALID_MODEL' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  const emit = (event: AgentEvent) => send(event);

  const orchestrator = dependencies.readOrchestrator();
  const run =
    orchestrator === 'langgraph'
      ? dependencies.runHseAgent({ message, history, conversationId, threadId, model: languageModel, emit, threadStore: dependencies.threadStateStore, memoryService: dependencies.longTermMemoryService, approvalService: dependencies.humanApprovalService, tools: dependencies.tools, toolFactory: dependencies.toolFactory, attachments, attachmentContext, locale })
      : dependencies.runLegacyAgent({ message, history, conversationId, model: languageModel, emit, tools: dependencies.tools ?? dependencies.toolFactory?.(false) });

  const result = await run;

  // Extra fields are additive: the widget reads `type`, everything else is optional
  // metadata for future UI (run tracing, conversation continuity).
  send({
    type: 'done',
    runId: result.runId,
    conversationId: result.conversationId,
    threadId: result.conversationId,
    status: result.status,
    toolsUsed: result.toolsUsed,
    stepCount: result.stepCount,
    ragUsed: result.ragUsed ?? false,
    citations: result.citations ?? [],
    errorCode: result.errorCode,
    orchestrator,
    approvalRequest: result.approvalRequest,
    executionTrace: result.executionTrace,
  });
  res.end();
});
return router;
}
