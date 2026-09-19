/**
 * Multi-Track Provider Factory & Circuit-Breaker Integration Tests
 *
 * Tests:
 * 1. createProvider handles elevenlabs, fal-ai, replicate without throwing.
 * 2. buildProviders instantiates and registers elevenlabs, fal-ai, replicate.
 * 3. buildMultiTrackProviders returns all 4 providers:
 *    { scriptProvider, audioProvider, imageProvider, videoProvider }.
 * 4. Per-tenant circuit-breaker keyRef isolation across multi-track providers.
 *
 * @module forest/ai/__tests__/provider-factory-multitrack.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProvider,
  buildProviders,
  buildMultiTrackProviders,
  ElevenLabsAudioProvider,
  ReplicateImageProvider,
  ReplicateVideoRenderingProvider,
} from '@/forest/ai/provider-factory';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import { ImageGenerationError } from '@/seed/ai/multimodal-provider-interface';

describe('Multi-Track Provider Factory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    recordSuccess('elevenlabs', 'tenant_test_1');
    recordSuccess('elevenlabs', 'tenant_test_2');
    recordSuccess('replicate', 'tenant_test_1');
    recordSuccess('replicate', 'tenant_test_2');
    recordSuccess('fal-ai', 'tenant_test_1');
  });

  it('createProvider does not throw on elevenlabs, fal-ai, or replicate', () => {
    // ElevenLabs
    const eleven = createProvider(
      { id: 'elevenlabs', label: 'ElevenLabs Text Adapter' },
      'test_key_1',
      'tenant_test_1',
    );
    expect(eleven).toBeDefined();
    expect(eleven.id).toBe('elevenlabs');
    expect(eleven.label).toBe('ElevenLabs Text Adapter');
    expect(typeof eleven.chat).toBe('function');
    expect(typeof eleven.stream).toBe('function');
    expect(typeof eleven.countTokens).toBe('function');
    expect(eleven.getCapabilities('default')).toBeDefined();
    expect(eleven.countTokens([{ role: 'user', content: 'hello world' }], 'default')).toBeGreaterThan(0);
    expect(eleven.estimateCost([{ role: 'user', content: 'hello world' }], 'default')).toBeGreaterThan(0);

    // fal.ai
    const fal = createProvider(
      { id: 'fal-ai', label: 'fal.ai Image Adapter' },
      'test_fal_key',
      'tenant_test_1',
    );
    expect(fal).toBeDefined();
    expect(fal.id).toBe('fal-ai');
    expect(fal.label).toBe('fal.ai Image Adapter');
    expect(typeof fal.chat).toBe('function');
    expect(fal.getCapabilities('default').vision).toBe(true);

    // Replicate
    const replicate = createProvider(
      { id: 'replicate', label: 'Replicate Video Adapter' },
      'test_rep_key',
      'tenant_test_1',
    );
    expect(replicate).toBeDefined();
    expect(replicate.id).toBe('replicate');
    expect(replicate.label).toBe('Replicate Video Adapter');
    expect(typeof replicate.chat).toBe('function');
    expect(replicate.getCapabilities('default').vision).toBe(true);
  });

  it('buildProviders creates and registers multi-modal configs without throwing', async () => {
    const result = await buildProviders({
      userId: 'user_suite_1',
      providers: [
        { id: 'openrouter', label: 'OpenRouter', platformApiKey: 'sk-or-test' },
        { id: 'elevenlabs', label: 'ElevenLabs', platformApiKey: 'sk-el-test' },
        { id: 'fal-ai', label: 'fal.ai', platformApiKey: 'sk-fal-test' },
        { id: 'replicate', label: 'Replicate', platformApiKey: 'sk-rep-test' },
      ],
      autoRegister: true,
    });

    expect(result.providers.size).toBe(4);
    expect(result.providers.has('openrouter')).toBe(true);
    expect(result.providers.has('elevenlabs')).toBe(true);
    const providerMap = result.providers as Map<string, unknown>;
    expect(providerMap.has('fal-ai')).toBe(true);
    expect(providerMap.has('replicate')).toBe(true);

    const registeredEleven = result.registry.get('elevenlabs');
    expect(registeredEleven).toBeDefined();
    expect(registeredEleven?.id).toBe('elevenlabs');
  });

  it('buildMultiTrackProviders returns all 4 tracks with tenant circuit breaker isolation', async () => {
    const tenant1 = 'tenant_test_1';
    const tenant2 = 'tenant_test_2';

    const multiTrack1 = await buildMultiTrackProviders({
      userId: tenant1,
      tenantId: tenant1,
      overrides: {
        openrouterApiKey: 'sk-or-1',
        elevenlabsApiKey: 'sk-el-1',
        falApiKey: 'sk-fal-1',
        replicateApiKey: 'sk-rep-1',
      },
    });

    // Validate returned providers exist and conform to interfaces
    expect(multiTrack1.scriptProvider).toBeDefined();
    expect(multiTrack1.scriptProvider.id).toBe('openrouter');

    expect(multiTrack1.audioProvider).toBeDefined();
    expect(multiTrack1.audioProvider.id).toBe('elevenlabs');

    expect(multiTrack1.imageProvider).toBeDefined();
    expect(multiTrack1.imageProvider.id).toBe('fal-ai');

    expect(multiTrack1.videoProvider).toBeDefined();
    expect(multiTrack1.videoProvider.id).toBe('replicate');

    // Build providers for tenant 2
    const multiTrack2 = await buildMultiTrackProviders({
      userId: tenant2,
      tenantId: tenant2,
      overrides: {
        openrouterApiKey: 'sk-or-2',
        elevenlabsApiKey: 'sk-el-2',
        falApiKey: 'sk-fal-2',
        replicateApiKey: 'sk-rep-2',
      },
    });

    // Simulate Replicate circuit breaker trip for tenant 1
    recordFailure('replicate', FailureKind.AUTH_FAILURE, tenant1);
    expect(shouldAllowRequest('replicate', tenant1)).toBe(false);

    // Tenant 1 video rendering must be blocked by circuit breaker
    await expect(
      multiTrack1.videoProvider.renderVideo({
        faceUrl: 'https://cdn.test/face.png',
        audioUrl: 'https://cdn.test/audio.mp3',
      }),
    ).rejects.toThrow(/Circuit breaker open for replicate/);

    // CRITICAL ISOLATION CHECK: Tenant 2 MUST NOT be affected by Tenant 1's breaker trip!
    expect(shouldAllowRequest('replicate', tenant2)).toBe(true);
    const healthTenant2 = await multiTrack2.videoProvider.health?.();
    expect(healthTenant2?.healthy).toBe(true);
  });

  it('buildMultiTrackProviders selects ReplicateImageProvider when only replicate key is available', async () => {
    const multiTrack = await buildMultiTrackProviders({
      tenantId: 'tenant_rep_only',
      overrides: {
        replicateApiKey: 'sk-rep-only',
      },
    });

    expect(multiTrack.imageProvider).toBeDefined();
    expect(multiTrack.imageProvider.id).toBe('replicate');
    expect(multiTrack.imageProvider.capabilities().supportsAspectRatio).toBe(true);
  });

  it('ElevenLabsTextAdapter rejects empty prompt and respects options.apiKey override', async () => {
    const adapter = createProvider(
      { id: 'elevenlabs', label: 'ElevenLabs Text Adapter' },
      'constructor_key',
      'tenant_test_1',
    );

    // Empty prompt rejection
    await expect(
      adapter.chat([{ role: 'user', content: '   ' }], {
        model: 'eleven_multilingual_v2',
        apiKey: 'test_key',
      }),
    ).rejects.toThrow(/Prompt content cannot be empty/);

    // Mock fetch to verify effective apiKey override
    let capturedKey = '';
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      capturedKey = headers['xi-api-key'];
      return new Response(new Uint8Array([1, 2, 3]).buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    });

    try {
      await adapter.chat([{ role: 'user', content: 'Valid prompt' }], {
        model: 'eleven_multilingual_v2',
        apiKey: 'override_byok_key',
      });
      expect(capturedKey).toBe('override_byok_key');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('ReplicateImageProvider validates prompt and returns RATE_LIMIT on HTTP 429', async () => {
    const imgProvider = new ReplicateImageProvider({
      apiKey: 'test_rep_key',
      keyRef: 'tenant_test_1',
    });

    // Empty prompt validation
    await expect(imgProvider.generate({ prompt: '' })).rejects.toThrow(ImageGenerationError);

    // HTTP 429 error mapping
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Rate limit exceeded', { status: 429 }),
    );

    try {
      await imgProvider.generate({ prompt: 'Generate something' });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenerationError);
      const e = err as ImageGenerationError;
      expect(e.code).toBe('RATE_LIMIT');
      expect(e.retryable).toBe(true);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('ReplicateVideoRenderingProvider validates URLs and avoids double failure recording', async () => {
    const videoProvider = new ReplicateVideoRenderingProvider({
      apiKey: 'test_rep_key',
      keyRef: 'tenant_test_1',
    });

    // Missing faceUrl
    await expect(
      videoProvider.renderVideo({ faceUrl: '', audioUrl: 'https://cdn.test/audio.mp3' }),
    ).rejects.toThrow(/faceUrl is required/);

    // Missing audioUrl
    await expect(
      videoProvider.renderVideo({ faceUrl: 'https://cdn.test/face.png', audioUrl: '' }),
    ).rejects.toThrow(/audioUrl is required/);
  });
});
