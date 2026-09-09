import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AuthorizationError, requirePermission } from '../auth/authorization';
import { PostgresAlertRepository } from '../ai/alerts/alert.repository';
import { OperationalAttentionService } from '../ai/attention/operational-attention.service';
import { withAttentionLock } from '../ai/attention/attention-lock';
import type { AttentionSchedulerHealth } from '../ai/attention/attention.types';

const safe=(handler:RequestHandler):RequestHandler=>(req,res,next)=>{Promise.resolve(handler(req,res,next)).catch(next);};
export function createAlertsRouter(db: Pool, attention=new OperationalAttentionService(db), schedulerHealth:()=>AttentionSchedulerHealth=()=>({enabled:false,status:'DISABLED',leader:false,running:false})) {
  const router=Router(),repo=new PostgresAlertRepository(db);
  router.use('/ai/alerts',requirePermission('AI_USE'));
  router.get('/ai/alerts',safe(async(req,res)=>{
    const p=(req as AuthenticatedRequest).principal;
    const returnSummary=await repo.returnSummary(p.userId);
    res.json({alerts:await repo.list(p.userId),events:await repo.events(p.userId),returnSummary,scheduler:schedulerHealth(),readAt:new Date().toISOString()});
  }));
  router.post('/ai/alerts/evaluate',safe(async(req,res)=>{
    const p=(req as AuthenticatedRequest).principal;
    const locked=await withAttentionLock(db,()=>attention.reconcileScope(p));
    if(locked.status==='BUSY'){res.status(409).json({code:'RECONCILIATION_BUSY'});return;}
    res.status(locked.result.status==='FAILED'?503:200).json({result:locked.result});
  }));
  router.post('/ai/alerts/:id/acknowledge',safe(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),p=(req as AuthenticatedRequest).principal;
    const alert=await repo.acknowledge(p.userId,id);
    if(!alert){res.status(409).json({code:'ALERT_NOT_ACTIVE'});return;}res.json({alert});
  }));
  router.post('/ai/alerts/:id/snooze',safe(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),body=z.object({minutes:z.union([z.literal(30),z.literal(60),z.literal(720)])}).parse(req.body);
    const alert=await repo.snooze((req as AuthenticatedRequest).principal.userId,id,new Date(Date.now()+body.minutes*60000));
    if(!alert){res.status(409).json({code:'ALERT_CANNOT_SNOOZE'});return;}res.json({alert});
  }));
  router.post('/ai/alerts/notifications/voice/claim',safe(async(req,res)=>{
    const body=z.object({ids:z.array(z.string().uuid()).max(20)}).parse(req.body);
    res.json({alerts:await repo.claimVoice((req as AuthenticatedRequest).principal.userId,body.ids)});
  }));
  router.post('/ai/alerts/:id/notifications/voice/spoken',safe(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id),token=z.string().uuid().parse(req.body?.claimToken);
    if(!await repo.markVoiceSpoken((req as AuthenticatedRequest).principal.userId,id,token)){res.status(409).json({code:'VOICE_CLAIM_EXPIRED'});return;}res.status(204).send();
  }));
  router.use((error:unknown,_req:import('express').Request,res:import('express').Response,_next:import('express').NextFunction)=>{
    const status=error instanceof AuthorizationError?(error.code==='RESOURCE_NOT_FOUND'?404:403):error instanceof z.ZodError?400:503;
    res.status(status).json({code:error instanceof AuthorizationError?error.code:error instanceof z.ZodError?'INVALID_ALERT_REQUEST':'ALERT_UNAVAILABLE',error:'The requested alert is unavailable.'});
  });
  return router;
}
