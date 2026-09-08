import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { ElevenLabsAdapter, VoiceFailure, defaultPreference, type VoicePreference } from './elevenlabs';
import { createVoiceRouter } from '../../routes/voice';
import { PostgresVoicePreferences } from './preferences';
import { PostgresAlertRepository } from '../alerts/alert.repository';
const env={ELEVENLABS_API_KEY:'secret-test-only'};
const catalog=()=>Response.json({voices:[{voice_id:'voice1',name:'Test',labels:{gender:'female',language:'pt',accent:'brazilian'},secret:'private'},{voice_id:'voice2',name:'Unknown',labels:{}}],has_more:false});
const input={text:'Olá. Teste de voz.',voiceId:'voice1',locale:'pt-PT' as const,speed:1};
test('TTS uses official stream endpoint and safe projection without credentials',async()=>{
  const calls:Array<{url:string;init?:RequestInit}>=[];
  const adapter=new ElevenLabsAdapter(env,(async(url,init)=>{calls.push({url:String(url),init});return String(url).includes('/v2/voices')?catalog():new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});}) as typeof fetch);
  assert.deepEqual(await adapter.synthesize(input),Buffer.from([1,2,3]));
  assert.match(calls[1].url,/\/v1\/text-to-speech\/voice1\/stream/);
  const body=JSON.parse(calls[1].init!.body as string);assert.equal(body.text,input.text);assert.equal(body.model_id,'eleven_multilingual_v2');assert.equal(body.language_code,undefined);
  const voices=await adapter.voices();assert.equal(voices[0].profile,'FEMALE');assert.equal(voices[1].profile,'UNKNOWN');assert.ok(!JSON.stringify(voices).includes('secret'));
});
for(const config of [{},{...env,ELEVENLABS_ENABLED:'false'}])test('missing key or disabled never calls upstream',async()=>{
  const adapter=new ElevenLabsAdapter(config,(async()=>{throw new Error('Must not call');}) as typeof fetch);
  assert.equal(adapter.available,false);await assert.rejects(adapter.synthesize(input),{code:'UNAVAILABLE'});
});
for(const status of [401,402,403,404,429,500,422])test(`upstream ${status} is sanitized and classified`,async()=>{
  const adapter=new ElevenLabsAdapter(env,(async()=>new Response('secret-test-only',{status})) as typeof fetch);
  await assert.rejects(adapter.synthesize(input),(error:VoiceFailure)=>error.code!=='secret-test-only'&&error.fallbackAllowed===(status!==422));
});
test('timeouts and network failures are technical, without raw errors',async()=>{
  const timeout=new ElevenLabsAdapter(env,((_url,init)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new Error('secret-test-only'))))) as typeof fetch,5);
  await assert.rejects(timeout.synthesize(input),{code:'TIMEOUT'});
  const network=new ElevenLabsAdapter(env,(async()=>{throw new Error('secret-test-only');}) as typeof fetch);
  await assert.rejects(network.synthesize(input),{code:'NETWORK_ERROR'});
});
test('invalid voice, oversized text, Markdown and MIME fail safely',async()=>{
  const adapter=new ElevenLabsAdapter(env,(async(url)=>String(url).includes('/v2/')?catalog():new Response('not audio',{headers:{'content-type':'text/html'}})) as typeof fetch);
  await assert.rejects(adapter.synthesize({...input,voiceId:'unknown'}),{code:'VOICE_NOT_FOUND'});
  for(const text of ['x'.repeat(1201),'| ID | Name |','{"test":1}'])await assert.rejects(adapter.synthesize({...input,text}),{code:'INVALID_CONTENT',fallbackAllowed:false});
  await assert.rejects(adapter.synthesize(input),{code:'INVALID_AUDIO'});
});
test('authenticated HTTP preference ownership, validation and fallback metadata',async()=>{
  const values=new Map<string,VoicePreference>();
  const app=express();app.use(express.json());
  app.use((req:any,_res,next)=>{if(req.headers['x-test-user'])req.principal={userId:req.headers['x-test-user'],permissions:['AI_USE']};next();});
  app.use(createVoiceRouter({load:async id=>values.get(id)??{...defaultPreference},save:async(id,value)=>{values.set(id,value);return value;}},new ElevenLabsAdapter({})));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const port=(server.address() as any).port;
  const request=(method:string,path:string,user?:string,body?:unknown)=>new Promise<{status:number;body:any}>((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port,path,method,headers:{'content-type':'application/json',...(user?{'x-test-user':user}:{})}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode!,body:JSON.parse(raw)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
  try{
    assert.equal((await request('GET','/ai/voice/voices')).status,401);
    const preference={...defaultPreference,engine:'BROWSER',languageLocale:'pt-BR'};
    assert.equal((await request('PUT','/ai/voice-preferences','A',preference)).status,200);
    assert.equal((await request('GET','/ai/voice-preferences','A')).body.languageLocale,'pt-BR');
    assert.equal((await request('GET','/ai/voice-preferences','B')).body.languageLocale,'en');
    await request('PUT','/ai/voice-preferences','C',{...preference,languageLocale:'pt-PT'});
    assert.equal((await request('GET','/ai/voice-preferences','C')).body.languageLocale,'pt-PT');
    assert.equal((await request('PUT','/ai/voice-preferences','A',{...preference,userId:'B'})).status,400);
    for(const bad of [{speed:5},{languageLocale:'xx'},{voiceId:'../bad'}])assert.equal((await request('PUT','/ai/voice-preferences','A',{...preference,...bad})).status,400);
    const fail=await request('POST','/ai/voice/synthesize','A',input);assert.equal(fail.status,503);assert.equal(fail.body.effectiveEngine,'BROWSER_FALLBACK');assert.equal(fail.body.fallbackReason,'UNAVAILABLE');assert.ok(!JSON.stringify(fail).includes('secret-test-only'));
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('Postgres preferences bind session user and do not interpolate supplied values',async()=>{
  const calls:any[]=[];const repo=new PostgresVoicePreferences({query:async(sql:string,args:any[])=>{calls.push({sql,args});return{rows:[]};}} as any);
  const preference={...defaultPreference,languageLocale:'pt-BR' as const,genderProfile:'FEMALE' as const,voiceId:'voice1',voiceName:'Test',speed:.85};
  await repo.load('userA');await repo.save('userA',preference);assert.equal(calls[0].args[0],'userA');assert.match(calls[0].sql,/WHERE user_id=\$1/);assert.deepEqual(calls[1].args,['userA','ELEVENLABS','pt-BR','FEMALE','voice1','Test',.85]);
});
test('discovers filtered shared voices, preserves verified metadata and caches briefly',async()=>{
  const calls:string[]=[];const adapter=new ElevenLabsAdapter(env,(async(url)=>{calls.push(String(url));return String(url).includes('/shared-voices')?Response.json({voices:[{voice_id:'shared1',public_owner_id:'owner1',name:'Lisboa',gender:'Female',language:'pt',accent:'portuguese',category:'professional',verified_languages:[{language:'pt',locale:'pt-PT',model_id:'eleven_multilingual_v2'}]}]}):catalog();}) as typeof fetch);
  const first=await adapter.discover({locale:'pt-PT',gender:'FEMALE'}),second=await adapter.discover({locale:'pt-PT',gender:'FEMALE'});const shared=first.find(v=>v.id==='shared1')!;
  assert.equal(shared.source,'LIBRARY');assert.equal(shared.locale,'pt-PT');assert.equal(shared.profile,'FEMALE');assert.deepEqual(shared.verifiedLocales,['pt-PT']);assert.equal(calls.filter(url=>url.includes('/shared-voices')).length,1);assert.match(calls.find(url=>url.includes('/shared-voices'))!,/language=pt/);assert.match(calls.find(url=>url.includes('/shared-voices'))!,/locale=pt-PT/);assert.equal(second.length,first.length);assert.ok(!JSON.stringify(first).includes('secret-test-only'));
});
test('adds only an explicitly selected shared voice with sanitized projection',async()=>{
  const calls:Array<{url:string;body:string}>=[];const adapter=new ElevenLabsAdapter(env,(async(url,init)=>{calls.push({url:String(url),body:String(init?.body??'')});return Response.json({voice_id:'shared1'});}) as typeof fetch);
  assert.equal(await adapter.addShared('owner1','shared1','Lisboa'),'shared1');assert.match(calls[0].url,/\/v1\/voices\/add\/owner1\/shared1$/);assert.deepEqual(JSON.parse(calls[0].body),{new_name:'Lisboa',bookmarked:true});
});
test('claim reserves only; cooldown and VOICE_SPOKEN require successful completion',async()=>{
  const calls:any[]=[];const row={id:'alert',severity:'CRITICAL',evidence:[]};
  const repo=new PostgresAlertRepository({query:async(sql:string,args:any[])=>{calls.push({sql,args});return{rows:[row],rowCount:1};}} as any);
  await repo.claimVoice('A',['alert']);assert.match(calls[0].sql,/voice_claim_until/);assert.doesNotMatch(calls[0].sql,/SET last_voice_notification_at|notification_count=notification_count/);assert.equal(calls[1].args[3],'VOICE_QUEUED');
  await repo.markVoiceSpoken('A','alert','claim');assert.match(calls[2].sql,/notification_count=notification_count\+1/);assert.match(calls[2].sql,/voice_claim_until>now/);assert.equal(calls[3].args[3],'VOICE_SPOKEN');
});
