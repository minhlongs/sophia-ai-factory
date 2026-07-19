/**
 * ElevenLabs API Client — voice selection, API call, and audio storage.
 * Do not import from text-to-speech-generator-elevenlabs.ts here.
 *
 * @module ai/elevenlabs-api-client
 */

import { logger } from '@/seed/utils/logger-utility';
import { Tier } from '@/seed/types';
import { withTimeout } from '@/tree/byok/with-timeout';
import { ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/seed/services/errors';

/** Get default voice ID based on tier (ElevenLabs pre-made voice IDs) */
export function getDefaultVoiceId(tier: Tier): string {
  const voices: Record<Tier, string> = {
    MASTER: '21m00Tcm4TlvDq8ikWAM',     // Rachel - Professional
    ENTERPRISE: '21m00Tcm4TlvDq8ikWAM', // Rachel - Professional
    PREMIUM: 'EXAVITQu4vr4xnSDxMaL',    // Bella - Friendly
    BASIC: 'pNInz6obpgDQGcFmaJgB',       // Adam - Neutral
  };
  return process.env.ELEVENLABS_VOICE_ID || voices[tier];
}

/**
 * Upload audio buffer to Cloudflare R2 and return the public URL.
 * Falls back to a data URI when R2 is unavailable or R2_PUBLIC_BASE_URL not set.
 *
 * Key pattern: audio/{userId}/{videoId}/{uuid}.mp3
 * Pass userId and videoId via the options parameter when available.
 */
export async function uploadAudioToStorage(
  audioData: Uint8Array,
  opts?: { userId?: string; videoId?: string },
): Promise<string> {
  const userId = opts?.userId ?? 'unknown';
  const videoId = opts?.videoId ?? 'unknown';
  const key = `audio/${userId}/${videoId}/${crypto.randomUUID()}.mp3`;
  const { uploadAudioToR2 } = await import('@/land/r2/audio-upload');
  return uploadAudioToR2(audioData.buffer as ArrayBuffer, 'audio/mpeg', key);
}

export interface VoiceoverOutput {
  audio_url: string;
  duration: number;
}

/** Real ElevenLabs API integration */
export async function generateElevenLabsVoiceover(
  text: string,
  tier: Tier,
  apiKey: string,
  voiceId?: string
): Promise<VoiceoverOutput> {
  const defaultVoiceId = voiceId || getDefaultVoiceId(tier);
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${defaultVoiceId}`;

  const response = await withTimeout(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: tier === 'ENTERPRISE' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: tier === 'ENTERPRISE' ? 0.5 : 0.0,
        use_speaker_boost: tier !== 'BASIC',
      },
    }),
    provider: 'elevenlabs',
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new ProviderInvalidKeyError('elevenlabs', errorText);
    }
    if (response.status === 429 || response.status === 402) {
      throw new ProviderQuotaExceededError('elevenlabs', errorText);
    }
    throw new Error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioUrl = await uploadAudioToStorage(new Uint8Array(audioBuffer));
  const estimatedDuration = Math.floor(text.length / 15);

  return { audio_url: audioUrl, duration: estimatedDuration };
}

/** Mock voiceover generator for fallback when API key is absent or call fails */
export async function generateMockVoiceover(text: string, tier: Tier): Promise<VoiceoverOutput> {
  await new Promise(resolve => setTimeout(resolve, 2000));

  const mockAudioUrls = tier === 'ENTERPRISE'
    ? [
        'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
        'https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav',
      ]
    : [
        'https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav',
        'https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav',
      ];

  const selectedUrl = mockAudioUrls[Math.floor(Math.random() * mockAudioUrls.length)];
  return { audio_url: selectedUrl, duration: Math.floor(text.length / 15) };
}
