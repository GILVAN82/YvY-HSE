import '../../config/env.bootstrap';
import { ElevenLabsAdapter } from './elevenlabs';
async function main(){
  const adapter=new ElevenLabsAdapter();
  if(!adapter.available){console.log('SKIP: ElevenLabs unavailable');return;}
  const start=Date.now();let voiceId:string|null=null;
  try{const voices=await adapter.voices();voiceId=voices[0]?.id??null;if(!voiceId){console.log('SKIP: no available voice');return;}await adapter.synthesize({text:'Hello, I am YvY. Voice test.',locale:'en',speed:1,voiceId,preview:true});console.log(JSON.stringify({status:'PASS',model:adapter.model,voice:voiceId,latencyMs:Date.now()-start}));}
  catch{console.log(JSON.stringify({status:'FAIL',model:adapter.model,voice:voiceId,latencyMs:Date.now()-start}));process.exitCode=1;}
}
void main();
