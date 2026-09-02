export type VoiceStatus = 'idle'|'requesting-permission'|'listening'|'transcribing'|'processing'|'speaking'|'error';
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

