/**
 * ElevenLabs API Client — voice selection, API call, and audio storage.
 * Do not import from text-to-speech-generator-elevenlabs.ts here.
 *
 * @module ai/elevenlabs-api-client
 */

import { Tier } from '@/seed/types';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/seed/services/errors';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import {
  getDefaultVoiceId,
  uploadAudioToStorage,
  generateMockVoiceover,
  type VoiceoverOutput,
} from './elevenlabs-storage-helpers';

export { getDefaultVoiceId, uploadAudioToStorage, generateMockVoiceover };
export type { VoiceoverOutput };

/** Real ElevenLabs API integration with per-tenant circuit breaker isolation */
export async function generateElevenLabsVoiceover(
  text: string,
  tier: Tier,
  apiKey: string,
  voiceId?: string,
  deps?: {
    withTimeout?: (url: string, options: RequestInit & { provider?: string }) => Promise<Response>;
    uploadToR2?: (data: ArrayBuffer, mime: string, key: string) => Promise<string>;
    keyRef?: string;
    userId?: string;
  },
  keyRefParam?: string,
): Promise<VoiceoverOutput> {
  const effectiveKeyRef = deps?.keyRef ?? deps?.userId ?? keyRefParam;
  const defaultVoiceId = voiceId || getDefaultVoiceId(tier);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`;

  if (!shouldAllowRequest('elevenlabs', effectiveKeyRef)) {
    throw new Error('[ElevenLabs] Circuit breaker open for elevenlabs');
  }

  const requestBody = JSON.stringify({
    text,
    model_id: tier === 'ENTERPRISE' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: tier === 'ENTERPRISE' ? 0.5 : 0.0,
      use_speaker_boost: tier !== 'BASIC',
    },
  });

  const headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': apiKey,
  };

  let response: Response;

  try {
    if (deps?.withTimeout) {
      response = await deps.withTimeout(url, {
        method: 'POST',
        headers,
        body: requestBody,
        provider: 'elevenlabs',
      });
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('elevenlabs', classifyError(error), effectiveKeyRef);
    throw error;
  }

  if (!response.ok) {
    recordFailure('elevenlabs', classifyHttpStatus(response.status), effectiveKeyRef);
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new ProviderInvalidKeyError('elevenlabs', errorText);
    }
    if (response.status === 429 || response.status === 402) {
      throw new ProviderQuotaExceededError('elevenlabs', errorText);
    }
    throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
  }

  recordSuccess('elevenlabs', effectiveKeyRef);
  const audioBuffer = await response.arrayBuffer();
  const audioUrl = await uploadAudioToStorage(new Uint8Array(audioBuffer), {
    userId: effectiveKeyRef || 'elevenlabs',
    uploadToR2: deps?.uploadToR2,
  });
  const estimatedDuration = Math.max(1, Math.floor(text.length / 15));

  return { audio_url: audioUrl, duration: estimatedDuration, audio_buffer: audioBuffer };
}
