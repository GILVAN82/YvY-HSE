import type { Pool } from 'pg';
import { defaultPreference, type VoicePreference } from './elevenlabs';
export interface VoicePreferences {load(userId:string):Promise<VoicePreference>;save(userId:string,value:VoicePreference):Promise<VoicePreference>}
export class PostgresVoicePreferences implements VoicePreferences {
  constructor(private readonly db:Pool){}
  async load(userId:string):Promise<VoicePreference>{
    const {rows}=await this.db.query('SELECT engine,language_locale,voice_response_mode,gender_profile,voice_id,voice_name,speed FROM app_user_voice_preferences WHERE user_id=$1',[userId]);
    const row=rows[0];return row?{engine:row.engine,languageLocale:row.language_locale,voiceResponseMode:row.voice_response_mode??'VOICE_INPUT_ONLY',genderProfile:row.gender_profile,voiceId:row.voice_id,voiceName:row.voice_name,speed:Number(row.speed)}:{...defaultPreference};
  }
  async save(userId:string,value:VoicePreference){
    await this.db.query(`INSERT INTO app_user_voice_preferences(user_id,engine,language_locale,voice_response_mode,gender_profile,voice_id,voice_name,speed) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id) DO UPDATE SET engine=EXCLUDED.engine,language_locale=EXCLUDED.language_locale,voice_response_mode=EXCLUDED.voice_response_mode,gender_profile=EXCLUDED.gender_profile,voice_id=EXCLUDED.voice_id,voice_name=EXCLUDED.voice_name,speed=EXCLUDED.speed,updated_at=now()`,[userId,value.engine,value.languageLocale,value.voiceResponseMode,value.genderProfile,value.voiceId,value.voiceName,value.speed]);return value;
  }
}
