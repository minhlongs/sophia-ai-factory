/**
 * @module forest/ai/provider-factory
 *
 * Factory for creating AI provider instances from configuration.
 *
 * Resolves API keys with BYOK-first strategy:
 * 1. Check BYOK store (user-provided key) via tree resolver
 * 2. Fall back to platform environment variables
 *
 * Creates and registers OpenRouterProvider, AnthropicProvider, and multi-track
 * adapters for elevenlabs, fal-ai, and replicate.
 *
 * Layer rule: forest — imports seed + tree only.
 */

import type { Provider, ProviderId } from '@/seed/ai/provider-interface';
import { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';
import { isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import {
  isCertificationBlocking,
  getCertification,
  ProviderNotCertifiedError,
} from '@/seed/ai/provider-certification';
import type {
  ProviderConfig,
  ProviderFactoryOptions,
  ProviderFactoryResult,
} from './providers/types';
import { resolveApiKey } from './providers/key-resolver';
import { createProvider } from './providers/provider-creator';

// Re-exports for 100% backward compatibility
export type {
  SupportedProviderId,
  ProviderConfig,
  ProviderFactoryOptions,
  ProviderFactoryResult,
  MultiTrackProviderFactoryOptions,
  MultiTrackProviders,
} from './providers/types';

export { resolveApiKey } from './providers/key-resolver';
export { createProvider } from './providers/provider-creator';
export { buildMultiTrackProviders } from './providers/multitrack-builder';
export { getSharedRegistry, resetSharedRegistry } from './providers/registry-manager';

export { ElevenLabsAudioProvider, ElevenLabsTextAdapter } from './providers/elevenlabs-provider';
export { ReplicateImageProvider } from './providers/replicate-image-provider';
export { ReplicateVideoRenderingProvider } from './providers/replicate-video-provider';
export {
  FalAiAdapter,
  ReplicateAdapter,
  GenericNonTextAdapter,
  KNOWN_NON_TEXT_PROVIDERS,
} from './providers/generic-adapter';
export {
  KlingVideoClient,
  KlingVideoAdapter,
  type KlingVideoClientConfig,
} from './providers/kling-provider';
export {
  HunyuanVideoClient,
  HunyuanVideoAdapter,
  HunyuanVideo,
  type HunyuanVideoClientConfig,
} from './providers/hunyuan-provider';
export { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';

/**
 * Create provider instances from configuration, resolve API keys,
 * and register them in a shared ProviderRegistry.
 *
 * Key resolution order per provider:
 * 1. BYOK store (if BYOK_ENABLED=1 and userId provided)
 * 2. Platform env var / config fallback
 */
export async function buildProviders(
  options: ProviderFactoryOptions,
): Promise<ProviderFactoryResult> {
  const { userId, providers: configs, autoRegister = true, fallbackOrder } = options;

  const registry = new ProviderRegistry(fallbackOrder);
  const instances = new Map<ProviderId, Provider>();

  for (const config of configs) {
    const apiKey = await resolveApiKey(userId, config.id, config.platformApiKey);

    if (!apiKey) {
      logger.warn('[ProviderFactory] No API key resolved — skipping provider', undefined, {
        providerId: config.id,
        label: config.label,
        byokEnabled: isByokEnabled(),
        userId,
      });
      continue;
    }

    if (isCertificationBlocking(config.id)) {
      const cert = getCertification(config.id);
      logger.warn('[ProviderFactory] Provider blocked by certification', undefined, {
        providerId: config.id,
        certState: cert.state,
        security: cert.security,
        health: cert.health,
        reason: cert.reason,
      });
      throw new ProviderNotCertifiedError(config.id, cert.state, cert.reason);
    }

    const provider = createProvider(config, apiKey, config.keyRef ?? (userId || undefined));

    instances.set(config.id as ProviderId, provider);

    if (autoRegister) {
      registry.register(provider);
      logger.info('[ProviderFactory] Registered provider', undefined, {
        providerId: config.id,
        label: config.label,
      });
    }
  }

  return { providers: instances, registry };
}
