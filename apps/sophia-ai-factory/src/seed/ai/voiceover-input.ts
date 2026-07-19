export interface VoiceoverInput {
  script: string;
  voiceId?: string;
  language?: string;
  outputFormat?: string;
  speakingRate?: number;
  pitch?: number;
  stability?: number;
  ssml?: string;
  maxDurationSeconds?: number;
}
