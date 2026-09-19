/**
 * Challenger Empirical Verification Suite: Milestone 1 Retry Iteration 2
 *
 * Dedicated verification for:
 * 1. buildMultiTrackProviders and createProvider instantiate and register all providers without throwing.
 * 2. ReplicateVideoRenderingProvider does not duplicate failure counts on HTTP error.
 * 3. ReplicateImageProvider returns empty string instead of undefined on empty output array.
 *
 * Plus edge-case stress tests for error classification, input guards, and per-tenant circuit breaker isolation.
 *
 * @module forest/ai/__tests__/challenger-m1-retry2.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createProvider,
  buildProviders,
  buildMultiTrackProviders,
  ReplicateImageProvider,
  ReplicateVideoRenderingProvider,
  type SupportedProviderId,
} from '@/forest/ai/provider-factory';
import { FalImageProvider } from '@/seed/ai/providers/fal-image-provider';
import {
  getState,
  recordSuccess,
  reset,
  shouldAllowRequest,
} from '@/seed/security/circuit-breaker';
import { ImageGenerationError } from '@/seed/ai/multimodal-provider-interface';

describe('Challenger 2 Empirical Verification: Milestone 1 Retry 2', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // OBJECTIVE 1: buildMultiTrackProviders & createProvider Instantiation & Registration
  // ══════════════════════════════════════════════════════════════════════════
  describe('Objective 1: buildMultiTrackProviders and createProvider', () => {
    const supportedProviders: SupportedProviderId[] = [
      'openrouter',
      'anthropic',
      'elevenlabs',
      'fal-ai',
      'replicate',
    ];

    it('1.1 createProvider instantiates all 5 supported providers with complete Provider interface', () => {
      for (const id of supportedProviders) {
        const provider = createProvider(
          { id, label: `Test Provider ${id}` },
          'sk-test-empirical-key',
          'tenant_obj1',
        );

        expect(provider).toBeDefined();
        expect(provider.id).toBe(id);
        expect(provider.label).toBe(`Test Provider ${id}`);
        expect(typeof provider.chat).toBe('function');
        expect(typeof provider.stream).toBe('function');
        expect(typeof provider.countTokens).toBe('function');
        expect(typeof provider.estimateCost).toBe('function');
        expect(typeof provider.getCapabilities).toBe('function');

        const caps = provider.getCapabilities('default');
        expect(caps).toBeDefined();
        expect(typeof caps.maxInputTokens).toBe('number');
        expect(typeof caps.maxOutputTokens).toBe('number');
      }
    });

    it('1.2 createProvider throws Unsupported provider on invalid provider ID', () => {
      expect(() => {
        createProvider(
          { id: 'non-existent-ai' as SupportedProviderId, label: 'Invalid' },
          'sk-key',
        );
      }).toThrow(/Unsupported provider: non-existent-ai/);
    });

    it('1.3 buildProviders registers all 5 providers into registry without throwing ProviderNotCertifiedError', async () => {
      const result = await buildProviders({
        userId: 'user_challenger_suite',
        providers: [
          { id: 'openrouter', label: 'OpenRouter', platformApiKey: 'sk-or-key' },
          { id: 'anthropic', label: 'Anthropic', platformApiKey: 'sk-ant-key' },
          { id: 'elevenlabs', label: 'ElevenLabs', platformApiKey: 'sk-el-key' },
          { id: 'fal-ai', label: 'fal.ai', platformApiKey: 'sk-fal-key' },
          { id: 'replicate', label: 'Replicate', platformApiKey: 'sk-rep-key' },
        ],
        autoRegister: true,
      });

      expect(result.providers.size).toBe(5);
      for (const id of supportedProviders) {
        expect(result.providers.has(id as any)).toBe(true);
        const registered = result.registry.get(id as any);
        expect(registered).toBeDefined();
        expect(registered?.id).toBe(id);
      }
    });

    it('1.4 buildMultiTrackProviders returns all 4 multi-modal tracks without throwing', async () => {
      const providers = await buildMultiTrackProviders({
        userId: 'user_challenger_m1',
        tenantId: 'tenant_challenger_m1',
        overrides: {
          openrouterApiKey: 'sk-or-over',
          elevenlabsApiKey: 'sk-el-over',
          falApiKey: 'sk-fal-over',
          replicateApiKey: 'sk-rep-over',
        },
      });

      // Script provider
      expect(providers.scriptProvider).toBeDefined();
      expect(providers.scriptProvider.id).toBe('openrouter');

      // Audio provider
      expect(providers.audioProvider).toBeDefined();
      expect(providers.audioProvider.id).toBe('elevenlabs');
      expect(typeof providers.audioProvider.generateSpeech).toBe('function');

      // Image provider (fal preferred when falApiKey present)
      expect(providers.imageProvider).toBeDefined();
      expect(providers.imageProvider.id).toBe('fal-ai');
      expect(typeof providers.imageProvider.generate).toBe('function');

      // Video provider
      expect(providers.videoProvider).toBeDefined();
      expect(providers.videoProvider.id).toBe('replicate');
      expect(typeof providers.videoProvider.renderVideo).toBe('function');
      expect(typeof providers.videoProvider.checkStatus).toBe('function');
    });

    it('1.5 buildMultiTrackProviders routes to ReplicateImageProvider when only replicateApiKey is provided', async () => {
      const providers = await buildMultiTrackProviders({
        tenantId: 'tenant_rep_fallback',
        overrides: {
          replicateApiKey: 'sk-rep-only',
        },
      });

      expect(providers.imageProvider).toBeDefined();
      expect(providers.imageProvider.id).toBe('replicate');
      expect(providers.imageProvider instanceof ReplicateImageProvider).toBe(true);
    });

    it('1.6 buildMultiTrackProviders handles missing keys gracefully without throwing', async () => {
      // In absence of overrides and env vars, must return defaults without crashing
      const providers = await buildMultiTrackProviders({
        tenantId: 'tenant_no_keys',
      });

      expect(providers.scriptProvider).toBeDefined();
      expect(providers.audioProvider).toBeDefined();
      expect(providers.imageProvider).toBeDefined();
      expect(providers.videoProvider).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // OBJECTIVE 2: ReplicateVideoRenderingProvider Failure Count Deduplication
  // ══════════════════════════════════════════════════════════════════════════
  describe('Objective 2: ReplicateVideoRenderingProvider failure count deduplication', () => {
    it('2.1 renderVideo increments failureCount by exactly 1 on HTTP 500 (NO duplicate counting)', async () => {
      const keyRef = 'tenant_dedup_500';
      reset('replicate', keyRef);
      expect(getState('replicate', keyRef).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow(/Replicate renderVideo failed: 500/);

      // CRITICAL EMPIRICAL ORACLE:
      // In previous flawed code, failureCount would be 2 due to catch block duplicate recording.
      // With the fix, failureCount MUST be exactly 1!
      const state = getState('replicate', keyRef);
      expect(state.failureCount).toBe(1);
    });

    it('2.2 renderVideo increments failureCount by exactly 1 on HTTP 401 auth error', async () => {
      const keyRef = 'tenant_dedup_401';
      reset('replicate', keyRef);
      expect(getState('replicate', keyRef).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized token', { status: 401 }),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow(/Replicate renderVideo failed: 401/);

      const state = getState('replicate', keyRef);
      expect(state.failureCount).toBe(1);
    });

    it('2.3 renderVideo increments failureCount by exactly 1 on network fetch rejection', async () => {
      const keyRef = 'tenant_dedup_net';
      reset('replicate', keyRef);
      expect(getState('replicate', keyRef).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockRejectedValue(
        new TypeError('Failed to fetch (DNS failure)'),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow(/Failed to fetch/);

      const state = getState('replicate', keyRef);
      expect(state.failureCount).toBe(1);
    });

    it('2.4 checkStatus increments failureCount by exactly 1 on HTTP 500 (NO duplicate counting)', async () => {
      const keyRef = 'tenant_status_dedup_500';
      reset('replicate', keyRef);
      expect(getState('replicate', keyRef).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Service Unavailable', { status: 503 }),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      await expect(provider.checkStatus('job_status_503')).rejects.toThrow(
        /Replicate checkStatus failed: 503/,
      );

      const state = getState('replicate', keyRef);
      expect(state.failureCount).toBe(1);
    });

    it('2.5 checkStatus increments failureCount by exactly 1 on network failure', async () => {
      const keyRef = 'tenant_status_dedup_net';
      reset('replicate', keyRef);
      expect(getState('replicate', keyRef).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockRejectedValue(
        new TypeError('Socket timeout'),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      await expect(provider.checkStatus('job_status_timeout')).rejects.toThrow(
        /Socket timeout/,
      );

      const state = getState('replicate', keyRef);
      expect(state.failureCount).toBe(1);
    });

    it('2.6 Strict monotonicity: consecutive HTTP errors increment failure count strictly 1-by-1', async () => {
      const keyRef = 'tenant_monotonic_test';
      reset('replicate', keyRef);
      expect(getState('replicate', keyRef).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Bad Gateway', { status: 502 }),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      // Call 1
      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow();
      expect(getState('replicate', keyRef).failureCount).toBe(1);

      // Call 2
      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow();
      expect(getState('replicate', keyRef).failureCount).toBe(2);

      // Call 3
      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow();
      expect(getState('replicate', keyRef).failureCount).toBe(3);
    });

    it('2.7 When circuit breaker is already OPEN, renderVideo does not increase failure count further', async () => {
      const keyRef = 'tenant_already_open';
      reset('replicate', keyRef);

      // Trip circuit breaker with 401 auth failure
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      );

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow();

      expect(shouldAllowRequest('replicate', keyRef)).toBe(false);
      expect(getState('replicate', keyRef).failureCount).toBe(1);

      // Now breaker is OPEN. Attempting another renderVideo should throw circuit breaker error
      // without incrementing failureCount!
      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow(/Circuit breaker open for replicate/);

      expect(getState('replicate', keyRef).failureCount).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // OBJECTIVE 3: ReplicateImageProvider Empty Output Array Safety
  // ══════════════════════════════════════════════════════════════════════════
  describe('Objective 3: ReplicateImageProvider output guards', () => {
    const keyRef = 'tenant_image_guards';

    beforeEach(() => {
      reset('replicate', keyRef);
      recordSuccess('replicate', keyRef);
    });

    it('3.1 returns empty string "" (NOT undefined) when output is empty array []', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'pred_empty_arr',
            output: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      const res = await provider.generate({ prompt: 'A stunning waterfall' });
      expect(res.assetRef).toBe('');
      expect(typeof res.assetRef).toBe('string');
      expect(res.assetRef).not.toBeUndefined();
      expect(res.assetRef).not.toBeNull();
      expect(res.provider).toBe('replicate');
      expect(res.costCents).toBe(1);
    });

    it('3.2 returns empty string "" when output array contains null or undefined', async () => {
      // Test [null]
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'pred_null_arr',
            output: [null],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      const res1 = await provider.generate({ prompt: 'Test null output element' });
      expect(res1.assetRef).toBe('');
      expect(typeof res1.assetRef).toBe('string');

      // Test [undefined] / empty slot
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'pred_undef_arr',
            output: [undefined],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const res2 = await provider.generate({ prompt: 'Test undef output element' });
      expect(res2.assetRef).toBe('');
      expect(typeof res2.assetRef).toBe('string');
    });

    it('3.3 returns empty string "" when output property is missing or null', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'pred_no_output',
            // output field omitted
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      const res = await provider.generate({ prompt: 'Test omitted output' });
      expect(res.assetRef).toBe('');
      expect(typeof res.assetRef).toBe('string');
    });

    it('3.4 returns valid image URL when output array contains URLs', async () => {
      const url = 'https://replicate.delivery/pbxt/example123.png';
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'pred_valid',
            output: [url],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      const res = await provider.generate({ prompt: 'Cyberpunk car' });
      expect(res.assetRef).toBe(url);
    });

    it('3.5 returns valid image URL when output is a direct string', async () => {
      const url = 'https://replicate.delivery/pbxt/direct.png';
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'pred_direct_str',
            output: url,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef,
      });

      const res = await provider.generate({ prompt: 'Direct string test' });
      expect(res.assetRef).toBe(url);
    });

    it('3.6 ReplicateImageProvider ALSO deduplicates failure count on HTTP error', async () => {
      const keyRefImg = 'tenant_image_dedup';
      reset('replicate', keyRefImg);
      expect(getState('replicate', keyRefImg).failureCount).toBe(0);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Service Unavailable', { status: 503 }),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef: keyRefImg,
      });

      await expect(provider.generate({ prompt: 'A landscape' })).rejects.toThrow(
        ImageGenerationError,
      );

      // Verify exactly 1 failure recorded (NOT 2)
      expect(getState('replicate', keyRefImg).failureCount).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADVERSARIAL STRESS TESTS: Edge Cases & Boundary Constraints
  // ══════════════════════════════════════════════════════════════════════════
  describe('Adversarial Stress Tests & Boundary Validation', () => {
    it('4.1 ReplicateImageProvider rejects empty, whitespace, and newline-only prompts', async () => {
      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef: 'tenant_stress_1',
      });

      const invalidPrompts = ['', '   ', '\n\t  \n'];
      for (const prompt of invalidPrompts) {
        await expect(provider.generate({ prompt })).rejects.toThrow(ImageGenerationError);
        try {
          await provider.generate({ prompt });
        } catch (e) {
          const err = e as ImageGenerationError;
          expect(err.code).toBe('VALIDATION_ERROR');
          expect(err.retryable).toBe(false);
        }
      }
    });

    it('4.2 ReplicateVideoRenderingProvider rejects empty or whitespace URLs', async () => {
      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-rep-test',
        keyRef: 'tenant_stress_2',
      });

      await expect(
        provider.renderVideo({ faceUrl: '', audioUrl: 'https://cdn.example.com/audio.mp3' }),
      ).rejects.toThrow(/faceUrl is required/);

      await expect(
        provider.renderVideo({ faceUrl: '   ', audioUrl: 'https://cdn.example.com/audio.mp3' }),
      ).rejects.toThrow(/faceUrl is required/);

      await expect(
        provider.renderVideo({ faceUrl: 'https://cdn.example.com/face.png', audioUrl: '' }),
      ).rejects.toThrow(/audioUrl is required/);

      await expect(
        provider.renderVideo({ faceUrl: 'https://cdn.example.com/face.png', audioUrl: '   ' }),
      ).rejects.toThrow(/audioUrl is required/);
    });

    it('4.3 ReplicateImageProvider correctly classifies HTTP 429 as RATE_LIMIT and retryable', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Too Many Requests', { status: 429 }),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef: 'tenant_stress_429',
      });

      try {
        await provider.generate({ prompt: 'A sunny beach' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageGenerationError);
        const e = err as ImageGenerationError;
        expect(e.code).toBe('RATE_LIMIT');
        expect(e.retryable).toBe(true);
      }
    });

    it('4.4 ReplicateImageProvider correctly classifies HTTP 401 as AUTH_FAILURE and non-retryable', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Invalid API token', { status: 401 }),
      );

      const provider = new ReplicateImageProvider({
        apiKey: 'sk-rep-test',
        keyRef: 'tenant_stress_401',
      });

      try {
        await provider.generate({ prompt: 'A sunny beach' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageGenerationError);
        const e = err as ImageGenerationError;
        expect(e.code).toBe('AUTH_FAILURE');
        expect(e.retryable).toBe(false);
      }
    });

    it('4.5 Multi-tenant keyRef isolation: Tenant A breaker trip does not impact Tenant B', async () => {
      const tenantA = 'tenant_iso_A';
      const tenantB = 'tenant_iso_B';

      reset('replicate', tenantA);
      reset('replicate', tenantB);

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('Unauthorized token', { status: 401 }),
      );

      const providerA = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-bad-key',
        keyRef: tenantA,
      });

      const providerB = new ReplicateVideoRenderingProvider({
        apiKey: 'sk-good-key',
        keyRef: tenantB,
      });

      // Tenant A fails and trips circuit breaker
      await expect(
        providerA.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow(/Replicate renderVideo failed: 401/);

      expect(shouldAllowRequest('replicate', tenantA)).toBe(false);

      // Tenant B MUST still be allowed!
      expect(shouldAllowRequest('replicate', tenantB)).toBe(true);
      const healthB = await providerB.health();
      expect(healthB.healthy).toBe(true);
    });
  });
});
