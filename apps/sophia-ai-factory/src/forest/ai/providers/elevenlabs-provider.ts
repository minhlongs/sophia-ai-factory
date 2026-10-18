/**
 * @module forest/ai/providers/elevenlabs-provider
 * ElevenLabs audio and text provider adapters.
 *
 * Layer: forest — imports seed only.
 */

import {
  type IAudioProvider,
  type AudioGenerationInput,
  type AudioGenerationResult,
} from '@/seed/ai/multimodal-provider-interface';
import { generateElevenLabsVoiceover } from '@/seed/ai/elevenlabs-api-client';
import { shouldAllowRequest } from '@/seed/security/circuit-breaker';
import type { Tier } from '@/seed/types';
import { ElevenLabsTextAdapter } from './elevenlabs-text-adapter';

export { ElevenLabsTextAdapter };

export class ElevenLabsAudioProvider implements IAudioProvider {
  readonly id = 'elevenlabs';
  readonly label = 'ElevenLabs Audio';
  private readonly apiKey: string;
  private readonly keyRef: string;

  constructor(options: { apiKey: string; keyRef: string }) {
    this.apiKey = options.apiKey;
    this.keyRef = options.keyRef;
  }

  async generateSpeech(
    input: AudioGenerationInput,
    keyRefOverride?: string,
  ): Promise<AudioGenerationResult> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const start = Date.now();
    const res = await generateElevenLabsVoiceover(
      input.text,
      (input.tier as Tier) || 'BASIC',
      this.apiKey,
      input.voiceId,
      { keyRef: effectiveKeyRef },
      effectiveKeyRef,
    );
    const latencyMs = Date.now() - start;
    return {
      audioBuffer: res.audio_buffer ?? new ArrayBuffer(0),
      durationSeconds: res.duration,
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      latencyMs,
      audioUrl: res.audio_url,
    };
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const allowed = shouldAllowRequest('elevenlabs', effectiveKeyRef);
    return { healthy: allowed };
  }
}
