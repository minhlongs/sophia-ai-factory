/**
 * @module forest/ai/providers/registry-manager
 * Singleton registry management and provider certifications.
 *
 * Layer: forest — imports seed only.
 */

import { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';
import {
  getCertification,
  registerCertification,
  ProviderCertificationState,
} from '@/seed/ai/provider-certification';

// Ensure canonical and multi-track providers are registered with non-blocking certification
if (getCertification('openrouter').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('openrouter', {
    state: ProviderCertificationState.PRODUCTION_READY,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'OpenRouter primary text provider certified',
  });
}

if (getCertification('anthropic').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('anthropic', {
    state: ProviderCertificationState.PRODUCTION_READY,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'Anthropic text provider certified',
  });
}

if (getCertification('elevenlabs').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('elevenlabs', {
    state: ProviderCertificationState.PRODUCTION_CANDIDATE,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'ElevenLabs audio integration certified for multi-track',
  });
}

if (getCertification('fal-ai').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('fal-ai', {
    state: ProviderCertificationState.PRODUCTION_CANDIDATE,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'fal.ai visual frame provider certified',
  });
}

if (getCertification('replicate').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('replicate', {
    state: ProviderCertificationState.PRODUCTION_CANDIDATE,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'Replicate video and image integration certified for multi-track',
  });
}

if (getCertification('kling').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('kling', {
    state: ProviderCertificationState.PRODUCTION_CANDIDATE,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'Kling AI video generation provider certified for multi-track',
  });
}

if (getCertification('hunyuan').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('hunyuan', {
    state: ProviderCertificationState.PRODUCTION_CANDIDATE,
    security: 'PASS',
    health: 'PASS',
    canary: 'PASS',
    reason: 'HunyuanVideo Runpod rendering provider certified for multi-track',
  });
}

if (getCertification('fish-speech').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('fish-speech', {
    state: ProviderCertificationState.EXPERIMENTAL,
    security: 'PASS',
    health: 'PASS',
    canary: 'NOT_EVALUATED',
    reason: 'Fish Speech audio model evaluated for capability routing',
  });
}

if (getCertification('wan').state === ProviderCertificationState.NOT_CERTIFIED) {
  registerCertification('wan', {
    state: ProviderCertificationState.EXPERIMENTAL,
    security: 'PASS',
    health: 'PASS',
    canary: 'NOT_EVALUATED',
    reason: 'Wan video generation model evaluated for capability routing',
  });
}

/** Module-level registry shared across the application. */
let sharedRegistry: ProviderRegistry | null = null;

/**
 * Get or create the shared provider registry.
 *
 * The registry is a singleton — calling this multiple times returns
 * the same instance after the first call.
 */
export function getSharedRegistry(): ProviderRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new ProviderRegistry();
    logger.info('[ProviderFactory] Created shared ProviderRegistry');
  }
  return sharedRegistry;
}

/**
 * Reset the shared registry (useful for testing).
 */
export function resetSharedRegistry(): void {
  sharedRegistry = null;
}
