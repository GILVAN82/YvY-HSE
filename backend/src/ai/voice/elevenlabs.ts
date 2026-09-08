import { z } from 'zod';

export const voiceLocale = z.enum(['pt-PT','pt-BR','en','es','fr','de']);
export const preferenceSchema = z.object({
  engine:z.enum(['ELEVENLABS','BROWSER']), languageLocale:voiceLocale,
  genderProfile:z.enum(['FEMALE','MALE','UNKNOWN']), voiceId:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).nullable(),
  voiceName:z.string().max(120).nullable(), speed:z.number().min(0.7).max(1.2),
}).strict();
export type VoicePreference = z.infer<typeof preferenceSchema>;
export const defaultPreference:VoicePreference = {engine:'ELEVENLABS',languageLocale:'en',genderProfile:'UNKNOWN',voiceId:null,voiceName:null,speed:1};
export const synthesisSchema = z.object({text:z.string().trim().min(1).max(1200).refine(text=>!/[|{}]|```|https?:\/\//.test(text),'Use spoken summary only'),voiceId:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),locale:voiceLocale,speed:z.number().min(0.7).max(1.2),preview:z.boolean().optional()}).strict().refine(body=>!body.preview || body.text.length<=240);
export type Voice = {id:string;name:string;language:string|null;accent:string|null;profile:'FEMALE'|'MALE'|'UNKNOWN';previewUrl:string|null;category:string|null};
export class VoiceFailure extends Error {
  constructor(public code:string,public fallbackAllowed=true,public status=503){super(code);}
}
export class ElevenLabsAdapter {
  readonly model:string;
  readonly available:boolean;
  constructor(private readonly env:NodeJS.ProcessEnv=process.env,private readonly request:typeof fetch=fetch,private readonly timeoutMs=20000){
    this.model=env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    this.available=!!env.ELEVENLABS_API_KEY && env.ELEVENLABS_ENABLED!=='false';
  }
  private async call<T>(path:string,init:RequestInit,consume:(response:Response)=>Promise<T>,signal?:AbortSignal):Promise<T>{
    if(!this.available)throw new VoiceFailure('UNAVAILABLE');
    const controller=new AbortController();
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)controller.abort();
    const timer=setTimeout(abort,this.timeoutMs);
    try {
      const response=await this.request(`https://api.elevenlabs.io${path}`,{...init,redirect:'error',headers:{'xi-api-key':this.env.ELEVENLABS_API_KEY!,'Content-Type':'application/json',...init.headers},signal:controller.signal});
      if(!response.ok){
        // 402 means the authenticated account cannot synthesize with its current
        // plan/quota. It is an engine availability failure, so browser TTS may
        // safely take over; the spoken content itself was not rejected.
        const technical=[401,402,403,404,408,429].includes(response.status)||response.status>=500;
        throw new VoiceFailure(technical ? `UPSTREAM_${response.status}` : 'CONTENT_REJECTED',technical,technical?503:422);
      }
      return await consume(response);
    } catch(error){if(error instanceof VoiceFailure)throw error;throw new VoiceFailure(signal?.aborted?'CANCELLED':controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR');}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async voices(signal?:AbortSignal):Promise<Voice[]>{
    const voices:Voice[]=[];let cursor:string|undefined;
    for(let page=0;page<20;page++){
      const body=await this.call<{voices?:Array<{voice_id?:unknown;name?:unknown;labels?:Record<string,unknown>;category?:unknown;preview_url?:unknown}>;has_more?:boolean;next_page_token?:unknown}>(`/v2/voices?page_size=100${cursor?`&next_page_token=${encodeURIComponent(cursor)}`:''}`,{},async r=>await r.json() as any,signal);
      for(const v of body.voices??[]){
        if(typeof v.voice_id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(v.voice_id))continue;
        const label=(key:string)=>{const value=v.labels?.[key];return typeof value==='string'?value.slice(0,120):null;};
        const gender=label('gender')?.toLowerCase();
        let previewUrl:string|null=null;
        try{const url=new URL(String(v.preview_url));if(url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<2000)previewUrl=url.href;}catch{/* optional official metadata */}
        voices.push({id:v.voice_id,name:String(v.name??'Voice').slice(0,120),language:label('language'),accent:label('accent'),profile:gender==='female'?'FEMALE':gender==='male'?'MALE':'UNKNOWN',previewUrl,category:typeof v.category==='string'?v.category.slice(0,80):null});
      }
      if(!body.has_more)return voices;
      if(typeof body.next_page_token!=='string')throw new VoiceFailure('INVALID_RESPONSE');
      cursor=body.next_page_token;
    }
    throw new VoiceFailure('VOICE_CATALOG_LIMIT');
  }
  async synthesize(input:z.infer<typeof synthesisSchema>,signal?:AbortSignal):Promise<Buffer>{
    const parsed=synthesisSchema.safeParse(input);if(!parsed.success)throw new VoiceFailure('INVALID_CONTENT',false,400);
    const voices=await this.voices(signal);
    if(!voices.some(v=>v.id===input.voiceId))throw new VoiceFailure('VOICE_NOT_FOUND');
    return this.call(`/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/stream?output_format=mp3_44100_128`,{method:'POST',body:JSON.stringify({text:input.text,model_id:this.model,...(this.model==='eleven_multilingual_v2'?{}:{language_code:input.locale.split('-')[0]}),voice_settings:{speed:input.speed,stability:0.5,similarity_boost:0.75}})},async response=>{
      if(response.headers.get('content-type')?.split(';')[0]!=='audio/mpeg')throw new VoiceFailure('INVALID_AUDIO');
      const reader=response.body?.getReader();if(!reader)throw new VoiceFailure('INVALID_AUDIO');
      const chunks:Buffer[]=[];let length=0;
      try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>4*1024*1024)throw new VoiceFailure('AUDIO_LIMIT');chunks.push(Buffer.from(part.value));}}
      finally{await reader.cancel();}
      if(!length)throw new VoiceFailure('INVALID_AUDIO');
      return Buffer.concat(chunks);
    },signal);
  }
}
