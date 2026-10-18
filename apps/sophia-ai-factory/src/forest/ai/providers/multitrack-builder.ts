/**
 * @module forest/ai/providers/multitrack-builder
 * Orchestrates multi-track provider creation (script, audio, image, video).
 *
 * Layer: forest — imports seed and forest providers.
 */

import { OpenRouterProvider } from '../openrouter-provider';
import { ElevenLabsAudioProvider } from './elevenlabs-provider';
import { resolveApiKey } from './key-resolver';
import { selectImageProvider, selectVideoProvider } from './multitrack-media-selectors';
import type { MultiTrackProviderFactoryOptions, MultiTrackProviders } from './types';

/**
 * Build the full multi-track provider suite (script, audio, image, video)
 * wired with BYOK envelope decryption and per-tenant circuit breaker isolation.
 */
export async function buildMultiTrackProviders(
  options: MultiTrackProviderFactoryOptions,
): Promise<MultiTrackProviders> {
  const { userId, tenantId, overrides, videoProviderChoice, imageProviderChoice } = options;
  const effectiveKeyRef = userId || tenantId;

  // 1. Script Provider (OpenRouter / Anthropic)
  const openrouterKey =
    overrides?.openrouterApiKey ??
    (await resolveApiKey(userId, 'openrouter', process.env.OPENROUTER_API_KEY)) ??
    '';
  const scriptProvider = new OpenRouterProvider({
    apiKey: openrouterKey,
    label: 'OpenRouter (Multi-Track)',
  });

  // 2. Audio Provider (ElevenLabs)
  const elevenlabsKey =
    overrides?.elevenlabsApiKey ??
    (await resolveApiKey(userId, 'elevenlabs', process.env.ELEVENLABS_API_KEY)) ??
    '';
  const audioProvider = new ElevenLabsAudioProvider({
    apiKey: elevenlabsKey,
    keyRef: effectiveKeyRef,
  });

  // 3. Image Generation Provider (fal.ai preferred, Replicate fallback)
  const falKey =
    overrides?.falApiKey ??
    (await resolveApiKey(userId, 'fal-ai', process.env.FAL_KEY)) ??
    '';
  const replicateKey =
    overrides?.replicateApiKey ??
    (await resolveApiKey(userId, 'replicate', process.env.REPLICATE_API_KEY)) ??
    '';

  const imageProvider = selectImageProvider({
    imageProviderChoice,
    falKey,
    replicateKey,
    effectiveKeyRef,
  });

  // 4. Video Rendering Provider (Kling AI / Hunyuan / Replicate)
  const klingKey =
    overrides?.klingApiKey ??
    (await resolveApiKey(userId, 'kling', process.env.KLING_API_KEY || process.env.FAL_KEY)) ??
    '';
  const runpodKey =
    overrides?.runpodApiKey ??
    (await resolveApiKey(userId, 'hunyuan', process.env.RUNPOD_API_KEY)) ??
    '';

  const videoProvider = selectVideoProvider({
    videoProviderChoice,
    overrides,
    klingKey,
    falKey,
    runpodKey,
    replicateKey,
    effectiveKeyRef,
  });

  return {
    scriptProvider,
    audioProvider,
    imageProvider,
    videoProvider,
  };
}
