/**
 * Video Generation Types
 *
 * Shared types for Wan 2.1 video generation and Fish Speech TTS integration.
 */

// ─── Video Job ────────────────────────────────────────────────────────────────

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export type WanJobStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';

export interface VideoGenerateParams {
  prompt: string;
  aspectRatio?: VideoAspectRatio;
  /** Duration in seconds (5 or 10) */
  duration?: 5 | 10;
  seed?: number;
}

export interface VideoGenerateResult {
  jobId: string;
  status: WanJobStatus;
}

export interface ProviderVideoJobStatus {
  status: WanJobStatus;
  videoUrl?: string;
  error?: string;
}

// ─── Audio Track ──────────────────────────────────────────────────────────────

export type SupportedLanguage = 'en' | 'vi';

export interface SpeechGenerateParams {
  text: string;
  /** Fish Speech voice reference key or built-in voice id */
  voice?: string;
  language?: SupportedLanguage;
}

export interface SpeechGenerateResult {
  audioUrl: string;
  durationSec: number;
}

// ─── Inngest Event Payloads ───────────────────────────────────────────────────

export interface VideoGenerateRequestedEvent {
  missionId: string;
  tenantId: string;
  userId: string;
  prompt: string;
  /** Optional voiceover text; if absent, falls back to prompt */
  voiceoverText?: string;
  language?: SupportedLanguage;
}

// ─── Wan API shapes ──────────────────────────────────────────────────────────

export interface WanApiInput {
  prompt: string;
  aspect_ratio?: string;
  duration?: number;
  seed?: number;
}

export interface WanApiPrediction {
  id: string;
  status: WanJobStatus;
  output?: string | string[];
  error?: string;
}

// ─── Kling API shapes ────────────────────────────────────────────────────────

export interface KlingApiInput {
  prompt: string;
  aspect_ratio?: string;
  duration?: number;
  negative_prompt?: string;
}

/** Response from fal.ai queue submit */
export interface KlingApiResponse {
  request_id: string;
  status: string;
}

/** Response from fal.ai queue status poll */
export interface KlingJobStatusResponse {
  /** IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED */
  status: string;
  error?: string;
}

// ─── Fish Speech API shapes ───────────────────────────────────────────────────

export interface FishSpeechApiInput {
  text: string;
  voice?: string;
  language?: string;
}

export interface FishSpeechApiOutput {
  audio: { url: string };
  duration?: number;
}
