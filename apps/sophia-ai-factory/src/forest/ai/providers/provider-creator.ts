/**
 * @module forest/ai/providers/provider-creator
 * Factory function for instantiating provider adapters.
 *
 * Layer: forest — imports seed and forest providers.
 */

import type { Provider } from '@/seed/ai/provider-interface';
import { OpenRouterProvider } from '../openrouter-provider';
import { AnthropicProvider } from '../anthropic-provider';
import { ElevenLabsTextAdapter } from './elevenlabs-provider';
import {
  FalAiAdapter,
  ReplicateAdapter,
  GenericNonTextAdapter,
  KNOWN_NON_TEXT_PROVIDERS,
} from './generic-adapter';
import { KlingVideoAdapter } from './kling-provider';
import { HunyuanVideoAdapter } from './hunyuan-provider';
import type { ProviderConfig } from './types';

/**
 * Create a single provider instance from config + resolved key.
 * Supports text, audio, image, and video providers without throwing "Unsupported provider"
 * on standard non-text providers.
 */
export function createProvider(config: ProviderConfig, apiKey: string, keyRef?: string): Provider {
  const effectiveKeyRef = config.keyRef ?? keyRef ?? 'platform';

  switch (config.id) {
    case 'openrouter':
      return new OpenRouterProvider({
        apiKey,
        baseUrl: config.baseUrl,
        label: config.label,
      });

    case 'anthropic':
      return new AnthropicProvider({
        apiKey,
        label: config.label,
      });

    case 'elevenlabs':
      return new ElevenLabsTextAdapter({
        apiKey,
        label: config.label,
        keyRef: effectiveKeyRef,
      });

    case 'fal-ai':
      return new FalAiAdapter({
        apiKey,
        label: config.label,
        keyRef: effectiveKeyRef,
        baseUrl: config.baseUrl,
      });

    case 'replicate':
      return new ReplicateAdapter({
        apiKey,
        label: config.label,
        keyRef: effectiveKeyRef,
        baseUrl: config.baseUrl,
      });

    case 'kling':
    case 'kling-video':
      return new KlingVideoAdapter({
        apiKey,
        label: config.label,
        keyRef: effectiveKeyRef,
        baseUrl: config.baseUrl,
      });

    case 'hunyuan':
    case 'hunyuan-video':
      return new HunyuanVideoAdapter({
        apiKey,
        label: config.label,
        keyRef: effectiveKeyRef,
        baseUrl: config.baseUrl,
      });

    default: {
      if (KNOWN_NON_TEXT_PROVIDERS.has(config.id)) {
        return new GenericNonTextAdapter(config, apiKey, effectiveKeyRef);
      }
      throw new Error(`[ProviderFactory] Unsupported provider: ${config.id}`);
    }
  }
}
