export type VoiceStatus = 'idle'|'requesting-permission'|'listening'|'transcribing'|'processing'|'speaking'|'interrupted'|'error';
export type ConversationLanguage = 'en'|'pt'|'es'|'fr'|'de';

export interface VoiceTurnMetadata {
  detectedLanguage: ConversationLanguage;
  languageConfidence?: number;
  transcript: string;
  inputMode: 'voice';
  requestedResponseLanguage?: ConversationLanguage;
  effectiveResponseLanguage: ConversationLanguage;
}

export interface VoiceTranscriptResult {
  transcript: string;
  detectedLanguage: ConversationLanguage;
  languageConfidence?: number;
}

export interface YvyConversationalResponse { displayResponse:string;spokenResponse:string; }
export interface VoiceConversationTurn {
  id:string;role:'user'|'assistant';mode:'voice';language:ConversationLanguage;text:string;spokenText?:string;
  verificationStatus?:string;timestamp:string;
}
