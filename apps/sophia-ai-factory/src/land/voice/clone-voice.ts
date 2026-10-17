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
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import {
  ELEVENLABS_ADD_VOICE_URL,
  VoiceCloneConfigurationError,
  validateCloneInput,
  fetchSample,
  buildVoiceMultipartForm,
  type CloneVoiceInput,
  type CloneVoiceResult,
} from './clone-voice-helpers';

export {
  VoiceCloneConfigurationError,
  validateCloneInput,
  type CloneVoiceInput,
  type CloneVoiceResult,
};

interface ElevenLabsAddVoiceResponse {
  voice_id?: string;
  detail?: { message?: string } | string;
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
  const form = buildVoiceMultipartForm(input, samples);

  // Circuit breaker: check if ElevenLabs is available before fetch
  if (!shouldAllowRequest('elevenlabs')) {
    throw new Error('Circuit breaker open for ElevenLabs — too many failures');
  }

  try {
    const res = await fetch(ELEVENLABS_ADD_VOICE_URL, {
      method: 'POST',
      headers: { 'xi-api-key': keyOrNull },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read response body', { error: String(err), context: 'cloneVoice' });
        return '';
      });
      logger.warn('[clone-voice] ElevenLabs non-2xx', { status: res.status, body: body.slice(0, 200) });
      // Circuit breaker: classify HTTP status and record failure
      const kind = res.status === 401 || res.status === 403
        ? FailureKind.AUTH_FAILURE
        : res.status === 429 || res.status === 402
          ? FailureKind.RATE_LIMIT
          : FailureKind.SERVER_ERROR;
      recordFailure('elevenlabs', kind);
      throw new Error(`Voice provider returned ${res.status}`);
    }
    const json = (await res.json()) as ElevenLabsAddVoiceResponse;
    const voiceId = json.voice_id;
    if (!voiceId) {
      throw new Error('Voice provider returned no voice_id');
    }
    // Circuit breaker: record success
    recordSuccess('elevenlabs');
    return { voiceId, name: input.name.trim(), source, samplesUploaded: samples.length };
  } catch (err) {
    // HTTP-status failures are already recorded in the non-2xx branch
    if (!(err instanceof Error && err.message.startsWith('Voice provider returned'))) {
      const kind = classifyError(err);
      recordFailure('elevenlabs', kind);
    }
    logger.error('[clone-voice] failed', toError(err), { userId: input.userId, name: input.name });
    throw err;
  }
}
