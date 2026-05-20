/**
 * Algorithm: clone a voice with ElevenLabs using the customer's BYOK key.
 *
 * Delivers the homepage promise "ElevenLabs Voice Integration (BYOK)" by
 * exposing the same /v1/voices/add capability ElevenLabs offers, wrapped
 * so the rest of the platform (REST API + Telegram /clone-voice + the
 * OpenClaw bridge) can call it without re-implementing the multipart
 * upload, the BYOK negotiation, or the error shape.
 *
 * Input audio is supplied as a list of URLs (R2 public URLs, signed S3
 * URLs, or any reachable HTTP source). The algorithm fetches each URL,
 * verifies size, and forwards as multipart/form-data to ElevenLabs.
 *
 * Doctrine: no operator credential is hard-required. Customer supplies
 * their own ElevenLabs key via the Setup Wizard.
 *
 * @module land/voice/clone-voice
 */
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

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

export class VoiceCloneConfigurationError extends Error {
  code: 'BYOK_REQUIRED' | 'EMPTY_AUDIO' | 'NAME_INVALID' | 'TOO_MANY_SAMPLES' | 'SAMPLE_TOO_LARGE';
  constructor(
    code: 'BYOK_REQUIRED' | 'EMPTY_AUDIO' | 'NAME_INVALID' | 'TOO_MANY_SAMPLES' | 'SAMPLE_TOO_LARGE',
    message: string,
  ) {
    super(message);
    this.name = 'VoiceCloneConfigurationError';
    this.code = code;
  }
}

const ELEVENLABS_ADD_VOICE_URL = 'https://api.elevenlabs.io/v1/voices/add';
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

interface ElevenLabsAddVoiceResponse {
  voice_id?: string;
  detail?: { message?: string } | string;
}

async function fetchSample(url: string): Promise<{ blob: Blob; filename: string }> {
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

/**
 * Compose: validate → resolve BYOK → download samples → multipart POST.
 * Returns {voiceId, name, source} on success; throws structured errors
 * the REST/Telegram surfaces can route to a friendly UI message.
 */
export async function cloneVoice(input: CloneVoiceInput): Promise<CloneVoiceResult> {
  validateCloneInput(input);

  const keyOrNull = await resolveUserApiKey(
    input.userId,
    'elevenlabs',
    process.env.ELEVENLABS_API_KEY ?? undefined,
  );
  if (!keyOrNull) {
    throw new VoiceCloneConfigurationError(
      'BYOK_REQUIRED',
      'Voice cloning requires an ElevenLabs key. Add yours in the Setup Wizard.',
    );
  }
  const source: 'user' | 'platform' = process.env.ELEVENLABS_API_KEY === keyOrNull ? 'platform' : 'user';

  const samples = await Promise.all(input.audioUrls.map((u) => fetchSample(u)));

  const form = new FormData();
  form.append('name', input.name.trim());
  if (input.description) form.append('description', input.description);
  if (input.labels) form.append('labels', JSON.stringify(input.labels));
  for (const { blob, filename } of samples) {
    // ElevenLabs accepts repeated `files` fields for multi-sample upload.
    form.append('files', blob, filename);
  }

  try {
    const res = await fetch(ELEVENLABS_ADD_VOICE_URL, {
      method: 'POST',
      headers: { 'xi-api-key': keyOrNull },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('[clone-voice] ElevenLabs non-2xx', { status: res.status, body: body.slice(0, 200) });
      throw new Error(`Voice provider returned ${res.status}`);
    }
    const json = (await res.json()) as ElevenLabsAddVoiceResponse;
    const voiceId = json.voice_id;
    if (!voiceId) {
      throw new Error('Voice provider returned no voice_id');
    }
    return { voiceId, name: input.name.trim(), source, samplesUploaded: samples.length };
  } catch (err) {
    logger.error('[clone-voice] failed', toError(err), { userId: input.userId, name: input.name });
    throw err;
  }
}
