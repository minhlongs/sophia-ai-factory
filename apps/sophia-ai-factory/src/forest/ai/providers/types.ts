/**
 * @module forest/ai/providers/types
 * Configuration and option interfaces for ProviderFactory.
 *
 * Layer: forest — imports seed only.
 */

import type { Provider, ProviderId } from '@/seed/ai/provider-interface';
import type { ProviderRegistry } from '@/seed/ai/provider-registry';
import type {
  IAudioProvider,
  IVideoRenderingProvider,
  ImageGenerationProvider,
} from '@/seed/ai/multimodal-provider-interface';

export type SupportedProviderId =
  | ProviderId
  | 'fal-ai'
  | 'replicate'
  | 'kling'
  | 'kling-video'
  | 'hunyuan'
  | 'hunyuan-video';

export interface ProviderConfig {
  /** Provider identifier. */
  id: SupportedProviderId;
  /** Human-readable label for logs and UI. */
  label: string;
  /** Platform-level API key (used when BYOK is off or user has no key). */
  platformApiKey?: string;
  /** Optional base URL override (for OpenRouter gateway routing). */
  baseUrl?: string;
  /** Optional keyRef for per-tenant circuit breaker isolation */
  keyRef?: string;
}

export interface ProviderFactoryOptions {
  /** User ID for BYOK key resolution. Pass null for platform-only mode. */
  userId?: string | null;
  /** Provider configurations to instantiate. */
  providers: ProviderConfig[];
  /** Whether to auto-register created providers in the global registry. */
  autoRegister?: boolean;
  /** Custom fallback order for the registry. */
  fallbackOrder?: ProviderId[];
}

export interface ProviderFactoryResult {
  /** Map of provider id → Provider instance. */
  providers: Map<ProviderId, Provider>;
  /** The shared provider registry. */
  registry: ProviderRegistry;
}

export interface MultiTrackProviderFactoryOptions {
  /** User ID for BYOK key resolution. Pass null for platform-only mode. */
  userId?: string | null;
  /** Tenant identifier for multi-tenant circuit breaker isolation. */
  tenantId: string;
  /** Optional video rendering provider choice ('kling' | 'hunyuan' | 'replicate' | 'default') */
  videoProviderChoice?: 'kling' | 'hunyuan' | 'replicate' | 'default';
  /** Optional image provider choice ('fal-ai' | 'replicate') */
  imageProviderChoice?: 'fal-ai' | 'replicate';
  /** Optional explicit API key overrides. */
  overrides?: {
    openrouterApiKey?: string;
    elevenlabsApiKey?: string;
    falApiKey?: string;
    replicateApiKey?: string;
    klingApiKey?: string;
    runpodApiKey?: string;
  };
}

export interface MultiTrackProviders {
  /** Text LLM provider for script generation (OpenRouter / Anthropic) */
  scriptProvider: Provider;
  /** Voice synthesis provider (ElevenLabs) */
  audioProvider: IAudioProvider;
  /** Frame / image generation provider (fal.ai / Replicate) */
  imageProvider: ImageGenerationProvider;
  /** Video rendering provider (Kling / Hunyuan / Replicate / Wav2Lip) */
  videoProvider: IVideoRenderingProvider;
}
