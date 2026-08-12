import '../../config/env.bootstrap';
import { randomUUID } from 'node:crypto';
import { resolveModel } from '../providers';
import { resumeHumanApproval, runHseAgent } from '../graph/hseAgent.runner';
import { createProductionAiComposition } from '../productionDependencies';

const composition = createProductionAiComposition();
const { threadStateStore, longTermMemoryService, humanApprovalService } = composition;
import { pool } from '../../db/pool';

async function request(threadId: string) {
  return runHseAgent({ threadId, message: 'Approve this LOTO as safe for execution.', model: resolveModel('openai', 'gpt-5.1'), emit: () => undefined, threadStore: threadStateStore, memoryService: longTermMemoryService, approvalService: humanApprovalService, toolFactory: composition.aiChatDependencies.toolFactory });
}

async function main() {
  const configured = !!process.env.OPENAI_API_KEY?.trim(); console.log(`OPENAI API CONFIGURED: ${configured ? 'YES' : 'NO'}`);
  if (!configured) throw new Error('OpenAI is not configured');
  const approveThread = randomUUID(); const rejectThread = randomUUID(); const approvals: string[] = [];
  try {
    const first = await request(approveThread); if (!first.approvalRequest) throw new Error('Approve-flow request did not pause'); approvals.push(first.approvalRequest.approvalId);
    const approved = await resumeHumanApproval({ approvalId: first.approvalRequest.approvalId, threadId: approveThread, decision: 'APPROVE', resolutionNote: 'Controlled Sprint 4.1 smoke approval.', approvalService: humanApprovalService, threadStore: threadStateStore });
    const second = await request(rejectThread); if (!second.approvalRequest) throw new Error('Reject-flow request did not pause'); approvals.push(second.approvalRequest.approvalId);
    const rejected = await resumeHumanApproval({ approvalId: second.approvalRequest.approvalId, threadId: rejectThread, decision: 'REJECT', resolutionNote: 'Controlled Sprint 4.1 smoke rejection.', approvalService: humanApprovalService, threadStore: threadStateStore });
    console.log(JSON.stringify({ approveRequestStatus: first.status, approveRequestRagUsed: first.ragUsed, approveSources: first.citations?.map((item) => item.sourceId) ?? [], approvedStatus: approved.approval.status, approvedTextAttributesHuman: /Human approval/.test(approved.text), rejectRequestStatus: second.status, rejectedStatus: rejected.approval.status, rejectedStopsAction: /stopped/.test(rejected.text) }));
  } finally {
    for (const id of approvals) await humanApprovalService.deleteForTest(id);
    await threadStateStore.reset(approveThread); await threadStateStore.reset(rejectThread);
  }
}

main().catch((error) => { console.error(`HITL smoke failed: ${error instanceof Error ? error.message : 'unknown error'}`); process.exitCode = 1; }).finally(() => pool.end());
