import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { hasPermission } from '../auth/authorization';
import { PostgresAlertRepository } from '../ai/alerts/alert.repository';
import { OperationalAttentionService } from '../ai/attention/operational-attention.service';
import type { AttentionSchedulerHealth } from '../ai/attention/attention.types';

export function createAlertsRouter(db: Pool, attention=new OperationalAttentionService(db), schedulerHealth:()=>AttentionSchedulerHealth=()=>({enabled:false,status:'DISABLED',leader:false,running:false})) {
  const router = Router(); const repo = new PostgresAlertRepository(db);
  router.get('/ai/alerts', async (req, res) => {
    const principal = (req as unknown as AuthenticatedRequest).principal;
    if (!hasPermission(principal, 'AI_USE')) { res.status(403).json({ error: 'Access denied.' }); return; }
    try {
      const returnSummary=await repo.returnSummary(principal.userId);res.json({alerts:await repo.list(principal.userId),events:await repo.events(principal.userId),returnSummary,scheduler:schedulerHealth(),readAt:new Date().toISOString()});
    } catch { res.status(503).json({ error: 'Proactive attention is temporarily unavailable.', code: 'ALERT_EVALUATION_UNAVAILABLE' }); }
  });
  router.post('/ai/alerts/evaluate',async(req,res)=>{const principal=(req as unknown as AuthenticatedRequest).principal;if(!hasPermission(principal,'AI_USE')){res.status(403).json({error:'Access denied.'});return;}try{const result=await attention.reconcileScope(principal);res.status(result.status==='FAILED'?503:200).json({result});}catch{res.status(503).json({error:'Proactive attention is temporarily unavailable.',code:'ALERT_EVALUATION_UNAVAILABLE'});}});
  router.post('/ai/alerts/:id/acknowledge', async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id); if (!id.success) { res.status(400).json({ error: 'Invalid alert.' }); return; }
    const principal = (req as unknown as AuthenticatedRequest).principal; const alert = await repo.acknowledge(principal.userId, id.data);
    if (!alert) { res.status(404).json({ error: 'Alert is unavailable.' }); return; } res.json({ alert });
  });
  router.post('/ai/alerts/:id/snooze', async (req, res) => {
    const id=z.string().uuid().safeParse(req.params.id);const body=z.object({minutes:z.union([z.literal(30),z.literal(60),z.literal(720)])}).safeParse(req.body);
    if(!id.success||!body.success){res.status(400).json({error:'Invalid snooze request.'});return;}const principal=(req as unknown as AuthenticatedRequest).principal;
    const alert=await repo.snooze(principal.userId,id.data,new Date(Date.now()+body.data.minutes*60_000));if(!alert){res.status(409).json({error:'This alert cannot be snoozed.'});return;}res.json({alert});
  });
  router.post('/ai/alerts/notifications/voice/claim',async(req,res)=>{const body=z.object({ids:z.array(z.string().uuid()).max(20)}).safeParse(req.body);if(!body.success){res.status(400).json({error:'Invalid alerts.'});return;}const principal=(req as unknown as AuthenticatedRequest).principal;res.json({alerts:await repo.claimVoice(principal.userId,body.data.ids)});});
  router.post('/ai/alerts/:id/notifications/voice/spoken',async(req,res)=>{const id=z.string().uuid().safeParse(req.params.id);if(!id.success){res.status(400).json({error:'Invalid alert.'});return;}const principal=(req as unknown as AuthenticatedRequest).principal;if(!await repo.markVoiceSpoken(principal.userId,id.data)){res.status(404).json({error:'Alert is unavailable.'});return;}res.status(204).send();});
  return router;
}
