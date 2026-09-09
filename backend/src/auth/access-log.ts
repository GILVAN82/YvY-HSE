import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { AuthenticatedRequest } from './auth.types';

const storage=new AsyncLocalStorage<{requestId:string;runId:string|null;threadId:string|null;role:string}>();
export const accessLogContext:RequestHandler=(req,_res,next)=>{
  const thread=req.body?.threadId;
  storage.run({requestId:randomUUID(),runId:null,threadId:typeof thread==='string'&&/^[a-f\d-]{36}$/i.test(thread)?thread:null,role:(req as AuthenticatedRequest).principal.role},next);
};
export function logAccessDenial(code:string,resourceType:string,operation:string,role?:string,context:{runId?:string;threadId?:string}={}) {
  const current=storage.getStore();
  console.warn(JSON.stringify({timestamp:new Date().toISOString(),requestId:current?.requestId??null,runId:context.runId??current?.runId??null,threadId:context.threadId??current?.threadId??null,role:role??current?.role??null,resourceType,operation,projectScopeDecision:'DENIED',errorCategory:code}));
}

export function setAgentLogContext(runId:string,threadId:string){const context=storage.getStore();if(context){context.runId=runId;context.threadId=threadId;}}
