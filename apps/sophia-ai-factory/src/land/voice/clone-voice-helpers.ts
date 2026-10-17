/**
 * Voice Cloning Validation & Sample Download Helpers
 *
 * @module land/voice/clone-voice-helpers
 */

import { assertSafeAudioUrl } from '@/seed/security/assert-safe-audio-url';

export interface CloneVoiceInput {
  userId: string;
  /** Display name for the voice (1–80 chars per ElevenLabs). */
  name: string;
  /** Public/signed audio URLs (1–25 samples, 1–11 minutes total). */
  audioUrls: string[];
  /** Optional human description shown in the ElevenLabs dashboard. */
  description?: string;
  /** Optional comma-separated labels. ElevenLabs expects a JSON object string. */
  labels?: Record<string, string>;
}

export interface CloneVoiceResult {
  voiceId: string;
  name: string;
  source: 'user' | 'platform';
  samplesUploaded: number;
}

export type VoiceCloneErrorCode =
  | 'BYOK_REQUIRED'
  | 'EMPTY_AUDIO'
  | 'NAME_INVALID'
  | 'TOO_MANY_SAMPLES'
  | 'SAMPLE_TOO_LARGE';

export class VoiceCloneConfigurationError extends Error {
  code: VoiceCloneErrorCode;
  constructor(code: VoiceCloneErrorCode, message: string) {
    super(message);
    this.name = 'VoiceCloneConfigurationError';
    this.code = code;
  }
}

export const ELEVENLABS_ADD_VOICE_URL = 'https://api.elevenlabs.io/v1/voices/add';
const MAX_SAMPLES = 25;
const MAX_BYTES_PER_SAMPLE = 11 * 1024 * 1024; // 11MB per ElevenLabs docs
const NAME_MIN = 1;
const NAME_MAX = 80;

/**
 * Pure helper: validate input shape before any network call. Public so
 * unit tests can exercise it without mocking fetch.
 */
export function validateCloneInput(input: CloneVoiceInput): void {
  const name = input.name?.trim() ?? '';
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new VoiceCloneConfigurationError('NAME_INVALID', `name must be ${NAME_MIN}–${NAME_MAX} chars`);
  }
  if (!Array.isArray(input.audioUrls) || input.audioUrls.length === 0) {
    throw new VoiceCloneConfigurationError('EMPTY_AUDIO', 'at least one audio URL is required');
  }
  if (input.audioUrls.length > MAX_SAMPLES) {
    throw new VoiceCloneConfigurationError('TOO_MANY_SAMPLES', `max ${MAX_SAMPLES} samples per voice`);
  }
}

export async function fetchSample(url: string): Promise<{ blob: Blob; filename: string }> {
  // SSRF guard: reject private IPs, loopback, link-local, non-http(s) schemes.
  assertSafeAudioUrl(url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`audio fetch ${url} returned ${res.status}`);
  }
  const blob = await res.blob();
  if (blob.size > MAX_BYTES_PER_SAMPLE) {
    throw new VoiceCloneConfigurationError(
      'SAMPLE_TOO_LARGE',
      `sample ${url} is ${blob.size} bytes (> ${MAX_BYTES_PER_SAMPLE})`,
    );
  }
  const filename = url.split('/').pop()?.split('?')[0] || 'sample.mp3';
  return { blob, filename };
}

export function buildVoiceMultipartForm(
  input: CloneVoiceInput,
  samples: Array<{ blob: Blob; filename: string }>,
): FormData {
  const form = new FormData();
  form.append('name', input.name.trim());
  if (input.description) form.append('description', input.description);
  if (input.labels) form.append('labels', JSON.stringify(input.labels));
  for (const { blob, filename } of samples) {
    form.append('files', blob, filename);
  }
  return form;
}
