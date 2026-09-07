import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { hasPermission } from '../auth/authorization';
import { ElevenLabsAdapter, preferenceSchema, synthesisSchema, VoiceFailure } from '../ai/voice/elevenlabs';
import type { VoicePreferences } from '../ai/voice/preferences';

export function createVoiceRouter(preferences:VoicePreferences,adapter=new ElevenLabsAdapter()){
  const router=Router();
  router.use(['/ai/voice','/ai/voice-preferences'],(req,res,next)=>{
    const principal=(req as AuthenticatedRequest).principal;
    if(!principal){res.status(401).json({code:'AUTH_REQUIRED'});return;}
    if(!hasPermission(principal,'AI_USE')){res.status(403).json({code:'ACCESS_DENIED'});return;}
    res.setHeader('Cache-Control','no-store');next();
  });
  const failure=(res:import('express').Response,error:unknown)=>{
    const e=error instanceof VoiceFailure?error:new VoiceFailure('VOICE_UNAVAILABLE');
    res.status(e.status).json({code:e.code,fallbackAllowed:e.fallbackAllowed,requestedEngine:'ELEVENLABS',effectiveEngine:e.fallbackAllowed?'BROWSER_FALLBACK':null,fallbackReason:e.code});
  };
  router.get('/ai/voice/voices',async(req,res)=>{try{res.json({available:adapter.available,voices:adapter.available?await adapter.voices():[],model:adapter.model});}catch(e){failure(res,e);}});
  router.get('/ai/voice-preferences',async(req,res)=>{try{res.json(await preferences.load((req as AuthenticatedRequest).principal.userId));}catch{res.status(503).json({code:'PREFERENCES_UNAVAILABLE'});}});
  router.put('/ai/voice-preferences',async(req,res)=>{
    const parsed=preferenceSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({code:'INVALID_PREFERENCE'});return;}
    try{const value=parsed.data;if(value.engine==='ELEVENLABS'&&value.voiceId){const voice=(await adapter.voices()).find(v=>v.id===value.voiceId);if(!voice){res.status(400).json({code:'INVALID_VOICE'});return;}value.voiceName=voice.name;value.genderProfile=voice.profile;}
      res.json(await preferences.save((req as AuthenticatedRequest).principal.userId,value));
    }catch{res.status(503).json({code:'PREFERENCES_UNAVAILABLE'});}
  });
  router.post('/ai/voice/synthesize',rateLimit({windowMs:60000,limit:12,keyGenerator:req=>(req as AuthenticatedRequest).principal.userId,standardHeaders:true,legacyHeaders:false,message:{code:'RATE_LIMIT',fallbackAllowed:true,fallbackReason:'RATE_LIMIT'}}),async(req,res)=>{
    const input=synthesisSchema.safeParse(req.body);if(!input.success){res.status(400).json({code:'INVALID_CONTENT',fallbackAllowed:false});return;}
    const controller=new AbortController();const abort=()=>{if(!res.writableEnded)controller.abort();};res.on('close',abort);
    try{const audio=await adapter.synthesize(input.data,controller.signal);if(!controller.signal.aborted)res.type('audio/mpeg').send(audio);}
    catch(e){if(!controller.signal.aborted)failure(res,e);}finally{res.off('close',abort);}
  });
  return router;
}
