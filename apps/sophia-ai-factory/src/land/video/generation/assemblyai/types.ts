export const DEFAULT_BASE_URL = 'https://api.assemblyai.com/v2';
export const DEFAULT_TIMEOUT_MS = 30_000; // 30s per individual request

export class AssemblyAIClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AssemblyAIClientError';
  }
}

export interface AssemblyAIClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface TranscriptWord {
  text: string;
  start: number; // milliseconds
  end: number;   // milliseconds
  confidence: number;
}

export interface TranscriptUtterance {
  text: string;
  start: number; // milliseconds
  end: number;   // milliseconds
  speaker: string;
}

export type TranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface TranscriptResponse {
  id: string;
  status: TranscriptStatus;
  text?: string;
  words?: TranscriptWord[];
  utterances?: TranscriptUtterance[];
  error?: string;
}

export interface TranscribeParams {
  audioUrl: string;
  /** BCP-47 language code: 'en', 'vi', or 'auto' for auto-detect. Default: 'auto' */
  languageCode?: string;
  speakerLabels?: boolean;
  punctuate?: boolean;
}

export interface TranscribeResult {
  transcriptId: string;
  status: string;
}
