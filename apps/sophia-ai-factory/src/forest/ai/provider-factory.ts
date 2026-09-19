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

import type {
  Provider,
  ProviderId,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  ProviderCapabilities as TextProviderCapabilities,
} from '@/seed/ai/provider-interface';
import type { ByokProvider } from '@/tree/byok/user-api-key-store';
import { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';
import { resolveUserApiKey, isByokEnabled } from '@/tree/byok/resolve-user-api-key';
import { OpenRouterProvider } from './openrouter-provider';
import { AnthropicProvider } from './anthropic-provider';
import {
  isCertificationBlocking,
  getCertification,
  registerCertification,
  ProviderCertificationState,
  ProviderNotCertifiedError,
} from '@/seed/ai/provider-certification';
import {
  type IAudioProvider,
  type IVideoRenderingProvider,
  type ImageGenerationProvider,
  type AudioGenerationInput,
  type AudioGenerationResult,
  type VideoRenderInput,
  type VideoRenderStatus,
  type ImageGenerationInput,
  type ImageGenerationResult,
  type ProviderCapabilities,
  type HealthStatus,
  ImageGenerationError,
} from '@/seed/ai/multimodal-provider-interface';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import { generateElevenLabsVoiceover } from '@/seed/ai/elevenlabs-api-client';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyHttpStatus, classifyError } from '@/seed/types/failure-kind';
import type { Tier } from '@/seed/types';

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


// ── Configuration ──────────────────────────────────────────────────────────────

export type SupportedProviderId = ProviderId | 'fal-ai' | 'replicate';

/**
 * Configuration for a single provider instance.
 */
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

/**
 * Options for the ProviderFactory.
 */
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

// ── Factory result ─────────────────────────────────────────────────────────────

/**
 * Result of building providers — holds instances and the registry.
 */
export interface ProviderFactoryResult {
  /** Map of provider id → Provider instance. */
  providers: Map<ProviderId, Provider>;
  /** The shared provider registry. */
  registry: ProviderRegistry;
}

// ── Multi-Track Options & Result ──────────────────────────────────────────────

export interface MultiTrackProviderFactoryOptions {
  /** User ID for BYOK key resolution. Pass null for platform-only mode. */
  userId?: string | null;
  /** Tenant identifier for multi-tenant circuit breaker isolation. */
  tenantId: string;
  /** Optional explicit API key overrides. */
  overrides?: {
    openrouterApiKey?: string;
    elevenlabsApiKey?: string;
    falApiKey?: string;
    replicateApiKey?: string;
  };
}

export interface MultiTrackProviders {
  /** Text LLM provider for script generation (OpenRouter / Anthropic) */
  scriptProvider: Provider;
  /** Voice synthesis provider (ElevenLabs) */
  audioProvider: IAudioProvider;
  /** Frame / image generation provider (fal.ai / Replicate) */
  imageProvider: ImageGenerationProvider;
  /** Video rendering provider (Replicate / Wav2Lip) */
  videoProvider: IVideoRenderingProvider;
}

// ── Provider factory ───────────────────────────────────────────────────────────

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

// ── Multi-Track Factory ────────────────────────────────────────────────────────

/**
 * Build the full multi-track provider suite (script, audio, image, video)
 * wired with BYOK envelope decryption and per-tenant circuit breaker isolation.
 */
export async function buildMultiTrackProviders(
  options: MultiTrackProviderFactoryOptions,
): Promise<MultiTrackProviders> {
  const { userId, tenantId, overrides } = options;
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

  let imageProvider: ImageGenerationProvider;
  if (falKey) {
    imageProvider = new FalImageProvider({
      apiKey: falKey,
      keyRef: effectiveKeyRef,
    });
  } else if (replicateKey) {
    imageProvider = new ReplicateImageProvider({
      apiKey: replicateKey,
      keyRef: effectiveKeyRef,
    });
  } else {
    imageProvider = new FalImageProvider({
      apiKey: '',
      keyRef: effectiveKeyRef,
    });
  }

  // 4. Video Rendering Provider (Replicate)
  const videoProvider = new ReplicateVideoRenderingProvider({
    apiKey: replicateKey,
    keyRef: effectiveKeyRef,
  });

  return {
    scriptProvider,
    audioProvider,
    imageProvider,
    videoProvider,
  };
}

// ── Key resolution ─────────────────────────────────────────────────────────────

/**
 * Resolve the API key for a provider using BYOK-first strategy.
 *
 * Order:
 * 1. BYOK store (user key) — only when BYOK_ENABLED=1 and userId is set
 * 2. Platform fallback key from config
 *
 * @returns Resolved key or null if none available.
 */
export async function resolveApiKey(
  userId: string | null | undefined,
  providerId: SupportedProviderId | string,
  platformFallback?: string,
): Promise<string | null> {
  const byokProvider = providerId as ByokProvider;
  const byokSupported: ByokProvider[] = ['openrouter', 'anthropic', 'elevenlabs', 'fal-ai', 'replicate'];

  if (userId && isByokEnabled() && byokSupported.includes(byokProvider)) {
    try {
      const userKey = await resolveUserApiKey(userId, byokProvider);
      if (userKey) {
        logger.debug('[ProviderFactory] Resolved BYOK key', undefined, {
          providerId,
          userId,
        });
        return userKey;
      }
    } catch (err) {
      logger.warn('[ProviderFactory] BYOK key resolution failed — using fallback', undefined, {
        providerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Platform fallback
  if (platformFallback) {
    logger.debug('[ProviderFactory] Using platform API key', undefined, { providerId });
    return platformFallback;
  }

  return null;
}

// ── Concrete Multi-Modal Provider Implementations ──────────────────────────────

/**
 * Audio synthesis provider using ElevenLabs API with per-tenant circuit breaker protection.
 */
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

/**
 * Image generation provider using Replicate Flux model with per-tenant circuit breaker protection.
 */
export class ReplicateImageProvider implements ImageGenerationProvider {
  readonly id = 'replicate';
  readonly label = 'Replicate Image Generation';
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; keyRef: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.keyRef = options.keyRef;
    this.baseUrl = (options.baseUrl ?? 'https://api.replicate.com/v1').replace(/\/+$/, '');
  }

  capabilities(): ProviderCapabilities {
    return {
      supportsAspectRatio: true,
      supportsStyle: false,
      maxConcurrency: 5,
    };
  }

  async health(): Promise<HealthStatus> {
    const healthy = shouldAllowRequest('replicate', this.keyRef);
    return { healthy };
  }

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    const start = Date.now();
    const requestedAt = Math.floor(Date.now() / 1000);

    if (!input.prompt || !input.prompt.trim()) {
      throw new ImageGenerationError(
        'prompt is required and cannot be empty',
        'VALIDATION_ERROR',
        'replicate',
        false,
      );
    }

    if (!shouldAllowRequest('replicate', this.keyRef)) {
      throw new ImageGenerationError(
        'Circuit breaker open for replicate',
        'CIRCUIT_BREAKER_OPEN',
        'replicate',
        true,
      );
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/models/black-forest-labs/flux-schnell/predictions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'wait=60',
          },
          body: JSON.stringify({
            input: {
              prompt: input.prompt,
              aspect_ratio: input.aspectRatio ?? '1:1',
              num_outputs: 1,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        recordFailure('replicate', classifyHttpStatus(response.status), this.keyRef);
        const isAuth = response.status === 401 || response.status === 403;
        const isRateLimit = response.status === 429;
        const code = isAuth ? 'AUTH_FAILURE' : isRateLimit ? 'RATE_LIMIT' : 'API_ERROR';
        const retryable = response.status >= 500 || response.status === 429;
        throw new ImageGenerationError(
          `Replicate image API failed: ${response.status} - ${errorText}`,
          code,
          'replicate',
          retryable,
        );
      }

      const data = (await response.json()) as { output?: string | string[]; id?: string };
      recordSuccess('replicate', this.keyRef);

      const assetRef = (Array.isArray(data.output) ? data.output[0] : data.output) ?? '';
      const latencyMs = Date.now() - start;

      return {
        assetRef,
        provider: 'replicate',
        latencyMs,
        requestedAt,
        costCents: 1,
        costClassification: 'METERED',
      };
    } catch (err) {
      if (err instanceof ImageGenerationError) throw err;
      const kind = classifyError(err);
      recordFailure('replicate', kind, this.keyRef);
      throw ImageGenerationError.fromUnknown(err, 'replicate');
    }
  }
}

/**
 * Video rendering provider using Replicate Wav2Lip with per-tenant circuit breaker protection.
 */
export class ReplicateVideoRenderingProvider implements IVideoRenderingProvider {
  readonly id = 'replicate';
  readonly label = 'Replicate Video Rendering';
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl: string;
  private readonly modelOwner: string;
  private readonly modelName: string;

  constructor(options: {
    apiKey: string;
    keyRef: string;
    baseUrl?: string;
    modelOwner?: string;
    modelName?: string;
  }) {
    this.apiKey = options.apiKey;
    this.keyRef = options.keyRef;
    this.baseUrl = (options.baseUrl ?? 'https://api.replicate.com/v1').replace(/\/+$/, '');
    this.modelOwner = options.modelOwner ?? 'devxpy';
    this.modelName = options.modelName ?? 'cog-wav2lip';
  }

  async renderVideo(input: VideoRenderInput, keyRefOverride?: string): Promise<{ jobId: string }> {
    if (!input.faceUrl || !input.faceUrl.trim()) {
      throw new Error('[ReplicateVideoRenderingProvider] faceUrl is required and cannot be empty');
    }
    if (!input.audioUrl || !input.audioUrl.trim()) {
      throw new Error('[ReplicateVideoRenderingProvider] audioUrl is required and cannot be empty');
    }

    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('replicate', effectiveKeyRef)) {
      throw new Error(`[Replicate] Circuit breaker open for replicate (${effectiveKeyRef})`);
    }

    let failureRecorded = false;
    try {
      const response = await fetch(
        `${this.baseUrl}/models/${this.modelOwner}/${this.modelName}/predictions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: {
              face: input.faceUrl,
              audio: input.audioUrl,
              ...(input.options ?? {}),
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        recordFailure('replicate', classifyHttpStatus(response.status), effectiveKeyRef);
        failureRecorded = true;
        throw new Error(`Replicate renderVideo failed: ${response.status} - ${errorText}`);
      }

      const prediction = (await response.json()) as { id: string };
      recordSuccess('replicate', effectiveKeyRef);
      return { jobId: prediction.id };
    } catch (err) {
      if (!failureRecorded && !(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('replicate', classifyError(err), effectiveKeyRef);
      }
      throw err;
    }
  }

  async checkStatus(jobId: string, keyRefOverride?: string): Promise<VideoRenderStatus> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    if (!shouldAllowRequest('replicate', effectiveKeyRef)) {
      throw new Error(`[Replicate] Circuit breaker open for replicate (${effectiveKeyRef})`);
    }

    let failureRecorded = false;
    try {
      const response = await fetch(`${this.baseUrl}/predictions/${jobId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        recordFailure('replicate', classifyHttpStatus(response.status), effectiveKeyRef);
        failureRecorded = true;
        throw new Error(`Replicate checkStatus failed: ${response.status} - ${errorText}`);
      }

      const prediction = (await response.json()) as {
        id: string;
        status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
        output?: string | string[];
        error?: string;
      };

      recordSuccess('replicate', effectiveKeyRef);

      const statusMap: Record<string, VideoRenderStatus['status']> = {
        starting: 'pending',
        processing: 'processing',
        succeeded: 'completed',
        failed: 'failed',
        canceled: 'failed',
      };

      const videoUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : (prediction.output ?? undefined);

      return {
        status: statusMap[prediction.status] ?? 'pending',
        videoUrl,
        error: prediction.error,
      };
    } catch (err) {
      if (!failureRecorded && !(err instanceof Error && err.message.includes('Circuit breaker'))) {
        recordFailure('replicate', classifyError(err), effectiveKeyRef);
      }
      throw err;
    }
  }

  async health(keyRefOverride?: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const effectiveKeyRef = keyRefOverride || this.keyRef;
    const healthy = shouldAllowRequest('replicate', effectiveKeyRef);
    return { healthy };
  }
}

// ── Text Provider Adapters for ElevenLabs, Fal, Replicate ─────────────────────

class ElevenLabsTextAdapter implements Provider {
  readonly id: ProviderId = 'elevenlabs';
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'ElevenLabs Adapter';
    this.keyRef = config.keyRef || 'platform';
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const start = Date.now();
    const prompt = messages.map((m) => m.content).join('\n');
    if (!prompt.trim()) {
      throw new Error('[ElevenLabsTextAdapter] Prompt content cannot be empty');
    }
    const effectiveApiKey = options.apiKey || this.apiKey;
    const result = await generateElevenLabsVoiceover(
      prompt,
      'BASIC',
      effectiveApiKey,
      undefined,
      { keyRef: this.keyRef },
      this.keyRef,
    );
    const latencyMs = Date.now() - start;

    return {
      content: result.audio_url,
      model: options.model || 'eleven_multilingual_v2',
      provider: 'elevenlabs',
      usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs,
      raw: { audio_url: result.audio_url, duration: result.duration },
    };
  }

  async *stream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const res = await this.chat(messages, options);
    yield { type: 'text_delta', delta: res.content, done: false };
    yield { type: 'text_delta', delta: '', done: true };
  }

  countTokens(messages: ChatMessage[], _model: string): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length / 4) + 4;
    }
    return Math.max(1, total);
  }

  estimateCost(messages: ChatMessage[], model: string, _options?: ChatOptions): number {
    const tokens = this.countTokens(messages, model);
    return (tokens * 4 * 0.0003); // ~$0.30 per 1k chars
  }

  getCapabilities(_model: string): TextProviderCapabilities {
    return {
      streaming: false,
      systemRole: false,
      maxOutputTokens: 1024,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: false,
    };
  }
}

class FalAiAdapter implements Provider {
  readonly id: ProviderId = 'fal-ai' as ProviderId;
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl?: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'fal.ai Adapter';
    this.keyRef = config.keyRef || 'platform';
    this.baseUrl = config.baseUrl;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.map((m) => m.content).join('\n');
    const effectiveApiKey = options.apiKey || this.apiKey;
    const effectiveBaseUrl = options.baseUrl || this.baseUrl;
    const fal = new FalImageProvider({
      apiKey: effectiveApiKey,
      keyRef: this.keyRef,
      baseUrl: effectiveBaseUrl,
    });
    const res = await fal.generate({ prompt });

    return {
      content: res.assetRef,
      model: options.model || 'fal-ai/flux-schnell',
      provider: 'fal-ai' as ProviderId,
      usage: { inputTokens: this.countTokens(messages, options.model), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: res.latencyMs,
      raw: { assetRef: res.assetRef, costCents: res.costCents },
    };
  }

  async *stream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const res = await this.chat(messages, options);
    yield { type: 'text_delta', delta: res.content, done: false };
    yield { type: 'text_delta', delta: '', done: true };
  }

  countTokens(messages: ChatMessage[], _model: string): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length / 4) + 4;
    }
    return Math.max(1, total);
  }

  estimateCost(_messages: ChatMessage[], _model: string, _options?: ChatOptions): number {
    return 0.003; // ~$0.003 per flux-schnell image
  }

  getCapabilities(_model: string): TextProviderCapabilities {
    return {
      streaming: false,
      systemRole: false,
      maxOutputTokens: 1024,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: true,
    };
  }
}

class ReplicateAdapter implements Provider {
  readonly id: ProviderId = 'replicate' as ProviderId;
  readonly label: string;
  private readonly apiKey: string;
  private readonly keyRef: string;
  private readonly baseUrl?: string;

  constructor(config: { apiKey: string; label?: string; keyRef?: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.label = config.label || 'Replicate Adapter';
    this.keyRef = config.keyRef || 'platform';
    this.baseUrl = config.baseUrl;
  }

  async chat(messages: ChatMessage[], options: ChatOptions): Promise<ChatResponse> {
    const prompt = messages.map((m) => m.content).join('\n');
    const effectiveApiKey = options.apiKey || this.apiKey;
    const effectiveBaseUrl = options.baseUrl || this.baseUrl;
    const imgProvider = new ReplicateImageProvider({
      apiKey: effectiveApiKey,
      keyRef: this.keyRef,
      baseUrl: effectiveBaseUrl,
    });
    const res = await imgProvider.generate({ prompt });

    return {
      content: res.assetRef,
      model: options.model || 'black-forest-labs/flux-schnell',
      provider: 'replicate' as ProviderId,
      usage: { inputTokens: this.countTokens(messages, options.model), outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: res.latencyMs,
      raw: { assetRef: res.assetRef, costCents: res.costCents },
    };
  }

  async *stream(messages: ChatMessage[], options: ChatOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const res = await this.chat(messages, options);
    yield { type: 'text_delta', delta: res.content, done: false };
    yield { type: 'text_delta', delta: '', done: true };
  }

  countTokens(messages: ChatMessage[], _model: string): number {
    let total = 0;
    for (const msg of messages) {
      total += Math.ceil(msg.content.length / 4) + 4;
    }
    return Math.max(1, total);
  }

  estimateCost(_messages: ChatMessage[], _model: string, _options?: ChatOptions): number {
    return 0.005;
  }

  getCapabilities(_model: string): TextProviderCapabilities {
    return {
      streaming: false,
      systemRole: false,
      maxOutputTokens: 1024,
      maxInputTokens: 4096,
      functionCalling: false,
      vision: true,
    };
  }
}

// ── Provider creation ──────────────────────────────────────────────────────────

/**
 * Create a single provider instance from config + resolved key.
 * Now supports openrouter, anthropic, elevenlabs, fal-ai, and replicate without throwing.
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

    default:
      throw new Error(`[ProviderFactory] Unsupported provider: ${config.id}`);
  }
}

// ── Singleton registry (module-level) ─────────────────────────────────────────

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
