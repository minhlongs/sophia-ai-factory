/**
 * @module seed/ai/multimodal-provider-interface
 *
 * Multi-Modal Provider Interfaces for Sophia AI Factory.
 * Defines contracts for audio (TTS), visual frame (image generation),
 * and video rendering providers.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type {
  ImageGenerationInput,
  ImageGenerationResult,
  ProviderCapabilities,
  HealthStatus,
  ImageGenerationProvider,
} from './image-generation-provider';

export type {
  ImageGenerationInput,
  ImageGenerationResult,
  ProviderCapabilities,
  HealthStatus,
  ImageGenerationProvider,
};
export { ImageGenerationError, isImageGenerationError } from './image-generation-provider';

/** Canonical generation modalities across the platform */
export type GenerationModality = 'text' | 'audio' | 'image' | 'video' | 'avatar';

// ── Audio (TTS) Interface ───────────────────────────────────────────────────

export interface AudioGenerationInput {
  /** The text to convert to speech */
  text: string;
  /** Optional voice ID (provider-specific) */
  voiceId?: string;
  /** Subscription/billing tier (e.g. 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER') */
  tier?: string;
  /** Model identifier override */
  model?: string;
  /** Speed adjustment factor (1.0 = normal) */
  speed?: number;
  /** Pitch adjustment */
  pitch?: number;
  /** Optional audio format requested */
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface AudioGenerationResult {
  /** Binary audio data */
  audioBuffer: ArrayBuffer;
  /** Duration in seconds */
  durationSeconds: number;
  /** MIME type of the audio data (e.g. 'audio/mpeg') */
  mimeType: string;
  /** Provider identifier that produced the audio */
  provider: string;
  /** Latency of the generation request in milliseconds */
  latencyMs: number;
  /** Public or stored URL of the audio file if persisted */
  audioUrl?: string;
}

export interface IAudioProvider {
  readonly id: string;
  readonly label: string;

  /**
   * Generate speech from text.
   * @param input - Audio generation parameters
   * @param keyRef - Optional tenant/user isolation key reference for circuit breakers
   */
  generateSpeech(input: AudioGenerationInput, keyRef?: string): Promise<AudioGenerationResult>;

  /** Optional health check for fallback routing */
  health?(keyRef?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }>;
}

// ── Video Rendering Interface ───────────────────────────────────────────────

export interface VideoRenderInput {
  /** Source avatar / face image URL */
  faceUrl: string;
  /** Audio track URL to synchronize/lip-sync */
  audioUrl: string;
  /** Optional script text for subtitles / alignment */
  script?: string;
  /** Optional job title / label */
  title?: string;
  /** Provider-specific render options */
  options?: Record<string, unknown>;
}

export interface VideoRenderStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** URL to the completed video output */
  videoUrl?: string;
  /** Error message if failed */
  error?: string;
  /** Optional progress percentage (0-100) */
  progress?: number;
}

export interface IVideoRenderingProvider {
  readonly id: string;
  readonly label: string;

  /**
   * Submit an asynchronous video rendering task.
   * @param input - Video render input parameters
   * @param keyRef - Optional tenant/user isolation key reference for circuit breakers
   */
  renderVideo(input: VideoRenderInput, keyRef?: string): Promise<{ jobId: string }>;

  /**
   * Check status of a video rendering job.
   * @param jobId - The job identifier returned by renderVideo
   * @param keyRef - Optional tenant/user isolation key reference for circuit breakers
   */
  checkStatus(jobId: string, keyRef?: string): Promise<VideoRenderStatus>;

  /** Optional health check */
  health?(keyRef?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }>;
}
