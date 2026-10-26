/**
 * @module seed/ai/certification/capability-matrix
 * In-memory provider certification registry matrix and capability lookup.
 */

import {
  type ProviderCertification,
  ProviderCertificationState,
} from './types';

const certificationStates = new Map<string, ProviderCertification>([
  [
    'openrouter',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'OpenRouter certified production fallback provider',
    },
  ],
  [
    'anthropic',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'Anthropic certified production fallback provider',
    },
  ],
  [
    'mekong_m1_max',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'Mekong AI local GPU edge node with Cloudflare Tunnel AES-256-GCM encryption',
    },
  ],
  [
    'fal_ai',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'Fal.ai unified 2026-2027 video aggregator & serverless FFmpeg compose provider',
    },
  ],
  [
    'fal-ai',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'Fal.ai unified 2026-2027 video aggregator & serverless FFmpeg compose provider',
    },
  ],
  [
    'replicate',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'Replicate secondary multi-model video aggregator & serverless FFmpeg fallback',
    },
  ],
  [
    'heygen',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'HeyGen Avatar V3 lip-sync authority segment provider',
    },
  ],
  [
    'elevenlabs',
    {
      state: ProviderCertificationState.PRODUCTION_READY,
      security: 'PASS',
      health: 'PASS',
      canary: 'PASS',
      reason: 'ElevenLabs multilingual neural voiceover provider',
    },
  ],
]);

/**
 * Register a provider's certification state.
 */
export function registerCertification(
  providerId: string,
  cert: ProviderCertification,
): void {
  certificationStates.set(providerId, cert);
}

/**
 * Retrieve the certification for a provider.
 * Returns a NOT_CERTIFIED default if no explicit registration exists.
 */
export function getCertification(providerId: string): ProviderCertification {
  return (
    certificationStates.get(providerId) ?? {
      state: ProviderCertificationState.NOT_CERTIFIED,
      security: 'NOT_EVALUATED',
      health: 'NOT_EVALUATED',
      canary: 'NOT_EVALUATED',
    }
  );
}
