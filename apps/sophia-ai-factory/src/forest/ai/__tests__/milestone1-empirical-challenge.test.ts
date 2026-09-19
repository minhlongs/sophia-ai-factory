/**
 * Empirical Challenge Harness: Milestone 1
 *
 * Challenges:
 * 1. Provider factory resolution for all supported providers:
 *    - createProvider for openrouter, anthropic, elevenlabs, fal-ai, replicate.
 *    - buildProviders for all providers (challenging certification state, missing keys).
 * 2. Adapter method compliance for ElevenLabsTextAdapter, FalAiAdapter, ReplicateAdapter:
 *    - Provider interface methods: chat, stream, countTokens, estimateCost, getCapabilities.
 *    - Response shapes, types, error handling, edge messages.
 * 3. ReplicateImageProvider & ReplicateVideoRenderingProvider edge cases:
 *    - Empty prompts, invalid aspect ratios, missing faceUrl/audioUrl, empty output arrays,
 *      HTTP 429 rate limit classification, circuit breaker integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createProvider,
  buildProviders,
  ReplicateImageProvider,
  ReplicateVideoRenderingProvider,
  type SupportedProviderId,
} from '@/forest/ai/provider-factory';
import {
  ProviderNotCertifiedError,
  getCertification,
  isCertificationBlocking,
  ProviderCertificationState,
} from '@/seed/ai/provider-certification';
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { ImageGenerationError } from '@/seed/ai/image-generation-provider';
import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';

describe('Milestone 1 Empirical Challenge Suite', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 1: Provider Factory Resolution
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge 1: createProvider and buildProviders Resolution', () => {
    const supportedProviders: SupportedProviderId[] = [
      'openrouter',
      'anthropic',
      'elevenlabs',
      'fal-ai',
      'replicate',
    ];

    it('1.1 createProvider instantiates all 5 supported providers without throwing Unsupported provider', () => {
      for (const providerId of supportedProviders) {
        expect(() => {
          const p = createProvider(
            { id: providerId, label: `Test ${providerId}` },
            'sk-test-key',
            'test_tenant',
          );
          expect(p).toBeDefined();
          expect(p.id).toBe(providerId);
          expect(typeof p.chat).toBe('function');
          expect(typeof p.stream).toBe('function');
          expect(typeof p.countTokens).toBe('function');
          expect(typeof p.estimateCost).toBe('function');
          expect(typeof p.getCapabilities).toBe('function');
        }).not.toThrow();
      }
    });

    it('1.2 createProvider throws Unsupported provider on unknown provider ID', () => {
      expect(() => {
        createProvider(
          { id: 'unknown-ai' as SupportedProviderId, label: 'Unknown AI' },
          'sk-key',
        );
      }).toThrow(/Unsupported provider: unknown-ai/);
    });

    it('1.3 EMPIRICAL DEFECT: buildProviders fails on openrouter and anthropic due to uncertified state', async () => {
      // In a fresh environment without manual registerCertification in test,
      // openrouter and anthropic default to NOT_CERTIFIED.
      // Since NOT_CERTIFIED is in BLOCKING_STATES, buildProviders throws ProviderNotCertifiedError!
      
      // Verify certification state directly
      const openrouterCert = getCertification('openrouter');
      const anthropicCert = getCertification('anthropic');

      // If they are NOT_CERTIFIED, verify that isCertificationBlocking returns true
      if (openrouterCert.state === ProviderCertificationState.NOT_CERTIFIED) {
        expect(isCertificationBlocking('openrouter')).toBe(true);

        // buildProviders MUST fail with ProviderNotCertifiedError
        await expect(
          buildProviders({
            userId: 'test_user',
            providers: [
              { id: 'openrouter', label: 'OpenRouter', platformApiKey: 'sk-or-test' },
            ],
            autoRegister: false,
          }),
        ).rejects.toThrow(ProviderNotCertifiedError);
      }

      if (anthropicCert.state === ProviderCertificationState.NOT_CERTIFIED) {
        expect(isCertificationBlocking('anthropic')).toBe(true);

        await expect(
          buildProviders({
            userId: 'test_user',
            providers: [
              { id: 'anthropic', label: 'Anthropic', platformApiKey: 'sk-ant-test' },
            ],
            autoRegister: false,
          }),
        ).rejects.toThrow(ProviderNotCertifiedError);
      }
    });

    it('1.4 buildProviders gracefully skips providers when no API key is resolved', async () => {
      const result = await buildProviders({
        userId: 'no_key_user',
        providers: [
          { id: 'elevenlabs', label: 'ElevenLabs' }, // no platformApiKey and no BYOK
        ],
        autoRegister: false,
      });

      expect(result.providers.size).toBe(0);
      expect(result.providers.has('elevenlabs')).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 2: Adapter Method Contracts & Compliance
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge 2: Adapter Method Compliance (ElevenLabs, FalAi, Replicate)', () => {
    it('2.1 ElevenLabsTextAdapter contract compliance: countTokens, estimateCost, getCapabilities', () => {
      const adapter = createProvider(
        { id: 'elevenlabs', label: 'ElevenLabs Adapter' },
        'sk-eleven-test',
        'tenant_eleven',
      );

      // countTokens
      expect(adapter.countTokens([], 'default')).toBe(1); // empty message safe fallback
      expect(
        adapter.countTokens(
          [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'World' },
          ],
          'default',
        ),
      ).toBeGreaterThan(1);

      // estimateCost
      const cost = adapter.estimateCost(
        [{ role: 'user', content: 'Sample voiceover script' }],
        'default',
      );
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');

      // getCapabilities
      const caps = adapter.getCapabilities('default');
      expect(caps).toEqual({
        streaming: false,
        systemRole: false,
        maxOutputTokens: 1024,
        maxInputTokens: 4096,
        functionCalling: false,
        vision: false,
      });
    });

    it('2.2 FalAiAdapter contract compliance: countTokens, estimateCost, getCapabilities', () => {
      const adapter = createProvider(
        { id: 'fal-ai', label: 'fal.ai Adapter' },
        'sk-fal-test',
        'tenant_fal',
      );

      // countTokens
      expect(adapter.countTokens([], 'default')).toBe(1);
      expect(
        adapter.countTokens(
          [{ role: 'user', content: 'Generate a cybernetic landscape' }],
          'default',
        ),
      ).toBeGreaterThan(1);

      // estimateCost
      const cost = adapter.estimateCost(
        [{ role: 'user', content: 'Prompt' }],
        'default',
      );
      expect(cost).toBe(0.003);

      // getCapabilities
      const caps = adapter.getCapabilities('default');
      expect(caps.vision).toBe(true);
      expect(caps.streaming).toBe(false);
      expect(caps.functionCalling).toBe(false);
    });

    it('2.3 ReplicateAdapter contract compliance: countTokens, estimateCost, getCapabilities', () => {
      const adapter = createProvider(
        { id: 'replicate', label: 'Replicate Adapter' },
        'sk-rep-test',
        'tenant_rep',
      );

      // countTokens
      expect(adapter.countTokens([], 'default')).toBe(1);
      expect(
        adapter.countTokens(
          [{ role: 'user', content: 'Generate a high quality photo' }],
          'default',
        ),
      ).toBeGreaterThan(1);

      // estimateCost
      const cost = adapter.estimateCost(
        [{ role: 'user', content: 'Prompt' }],
        'default',
      );
      expect(cost).toBe(0.005);

      // getCapabilities
      const caps = adapter.getCapabilities('default');
      expect(caps.vision).toBe(true);
      expect(caps.streaming).toBe(false);
      expect(caps.functionCalling).toBe(false);
    });

    it('2.4 ElevenLabsTextAdapter.chat & stream executes with mocked fetch', async () => {
      const mockAudioBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('elevenlabs.io')) {
          return new Response(mockAudioBuffer, {
            status: 200,
            headers: { 'Content-Type': 'audio/mpeg' },
          });
        }
        return new Response('Not found', { status: 404 });
      });

      const adapter = createProvider(
        { id: 'elevenlabs', label: 'ElevenLabs' },
        'sk-eleven-valid',
        'tenant_chat_1',
      );

      const messages: ChatMessage[] = [{ role: 'user', content: 'Speak this script' }];
      const options: ChatOptions = { model: 'eleven_multilingual_v2', apiKey: 'sk-eleven-valid' };

      const response = await adapter.chat(messages, options);
      expect(response).toBeDefined();
      expect(response.provider).toBe('elevenlabs');
      expect(response.model).toBe('eleven_multilingual_v2');
      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.stopReason).toBe('end_turn');

      // Test streaming generator yields chunks
      const chunks = [];
      for await (const chunk of adapter.stream(messages, options)) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe('text_delta');
      expect(chunks[0].done).toBe(false);
      expect(chunks[1].done).toBe(true);
    });

    it('2.5 ReplicateAdapter.chat & stream executes with mocked Replicate API', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('flux-schnell/predictions')) {
          return new Response(
            JSON.stringify({
              id: 'pred_rep_123',
              output: ['https://replicate.delivery/output.png'],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('Not found', { status: 404 });
      });

      const adapter = createProvider(
        { id: 'replicate', label: 'Replicate' },
        'sk-rep-valid',
        'tenant_rep_chat_1',
      );

      const messages: ChatMessage[] = [{ role: 'user', content: 'Generate a scenic sunset' }];
      const options: ChatOptions = { model: 'black-forest-labs/flux-schnell', apiKey: 'sk-rep-valid' };

      const response = await adapter.chat(messages, options);
      expect(response.content).toBe('https://replicate.delivery/output.png');
      expect(response.provider).toBe('replicate');
      expect(response.stopReason).toBe('end_turn');
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);

      // Stream
      const chunks = [];
      for await (const chunk of adapter.stream(messages, options)) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBe(2);
      if (chunks[0].type === 'text_delta') {
        expect(chunks[0].delta).toBe('https://replicate.delivery/output.png');
      }
      expect(chunks[0].done).toBe(false);
      expect(chunks[1].done).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // CHALLENGE 3: ReplicateImageProvider & ReplicateVideoRenderingProvider Edge Cases
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge 3: Replicate Image & Video Edge Cases', () => {
    const testKeyRef = 'tenant_edge_test';

    beforeEach(() => {
      recordSuccess('replicate', testKeyRef);
    });

    it('3.1 ReplicateImageProvider: handles aspect ratio and passes it in prediction body', async () => {
      let capturedBody: { input: { prompt: string; aspect_ratio: string } } | null = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({
            id: 'pred_1',
            output: ['https://replicate.delivery/result.png'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new ReplicateImageProvider({
        apiKey: 'r8_testkey',
        keyRef: testKeyRef,
      });

      // Default aspect ratio when none provided
      await provider.generate({ prompt: 'Cyberpunk street' });
      expect(capturedBody!.input.aspect_ratio).toBe('1:1');
      expect(capturedBody!.input.prompt).toBe('Cyberpunk street');

      // Specified aspect ratio
      await provider.generate({ prompt: 'Portrait shot', aspectRatio: '9:16' });
      expect(capturedBody!.input.aspect_ratio).toBe('9:16');
    });

    it('3.2 REMEDIATED BEHAVIOR: ReplicateImageProvider with empty output array safely returns empty string without crashing', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            id: 'pred_empty_output',
            output: [], // Replicate returns empty output array
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new ReplicateImageProvider({
        apiKey: 'r8_testkey',
        keyRef: testKeyRef,
      });

      const result = await provider.generate({ prompt: 'Test' });
      // Guarded output: (Array.isArray(data.output) ? data.output[0] : data.output) ?? ''
      expect(result.assetRef).toBe('');
    });

    it('3.3 ReplicateImageProvider: Auth failure (401) sets AUTH_FAILURE and opens circuit breaker', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Invalid token', { status: 401 });
      });

      const provider = new ReplicateImageProvider({
        apiKey: 'r8_invalid',
        keyRef: testKeyRef,
      });

      await expect(provider.generate({ prompt: 'Test' })).rejects.toThrow(ImageGenerationError);

      // Verify circuit breaker tripped
      expect(shouldAllowRequest('replicate', testKeyRef)).toBe(false);

      // Subsequent call fails immediately at circuit breaker gate before fetch
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;
      await expect(provider.generate({ prompt: 'Second call' })).rejects.toThrow(
        /Circuit breaker open for replicate/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('3.4 REMEDIATED BEHAVIOR: ReplicateImageProvider correctly classifies HTTP 429 as RATE_LIMIT with retryable: true', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Rate limit exceeded', { status: 429 });
      });

      const provider = new ReplicateImageProvider({
        apiKey: 'r8_test',
        keyRef: testKeyRef,
      });

      try {
        await provider.generate({ prompt: 'Test' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ImageGenerationError);
        const imgErr = err as ImageGenerationError;
        expect(imgErr.code).toBe('RATE_LIMIT');
        expect(imgErr.retryable).toBe(true);
      }
    });

    it('3.5 ReplicateVideoRenderingProvider: renderVideo handles faceUrl, audioUrl, options', async () => {
      let capturedBody: { input: { face: string; audio: string; pads?: number[]; smooth?: boolean } } | null = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({ id: 'job_wav2lip_456' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'r8_test',
        keyRef: testKeyRef,
      });

      const res = await provider.renderVideo({
        faceUrl: 'https://cdn.example.com/face.png',
        audioUrl: 'https://cdn.example.com/voice.mp3',
        options: { pads: [0, 10, 0, 0], smooth: true },
      });

      expect(res.jobId).toBe('job_wav2lip_456');
      expect(capturedBody!.input.face).toBe('https://cdn.example.com/face.png');
      expect(capturedBody!.input.audio).toBe('https://cdn.example.com/voice.mp3');
      expect(capturedBody!.input.pads).toEqual([0, 10, 0, 0]);
      expect(capturedBody!.input.smooth).toBe(true);
    });

    it('3.6 ReplicateVideoRenderingProvider: checkStatus maps all Replicate lifecycle statuses', async () => {
      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'r8_test',
        keyRef: testKeyRef,
      });

      const statusMapTest = [
        { replicateStatus: 'starting', expected: 'pending' },
        { replicateStatus: 'processing', expected: 'processing' },
        { replicateStatus: 'succeeded', expected: 'completed' },
        { replicateStatus: 'failed', expected: 'failed' },
        { replicateStatus: 'canceled', expected: 'failed' },
      ];

      for (const { replicateStatus, expected } of statusMapTest) {
        globalThis.fetch = vi.fn().mockImplementation(async () => {
          return new Response(
            JSON.stringify({
              id: 'job_status_test',
              status: replicateStatus,
              output: replicateStatus === 'succeeded' ? ['https://cdn.example.com/video.mp4'] : null,
              error: replicateStatus === 'failed' ? 'OOM killed' : undefined,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        });

        const statusResult = await provider.checkStatus('job_status_test');
        expect(statusResult.status).toBe(expected);
        if (replicateStatus === 'succeeded') {
          expect(statusResult.videoUrl).toBe('https://cdn.example.com/video.mp4');
        }
        if (replicateStatus === 'failed') {
          expect(statusResult.error).toBe('OOM killed');
        }
      }
    });

    it('3.7 ReplicateVideoRenderingProvider: checkStatus handles single string output or array output', async () => {
      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'r8_test',
        keyRef: testKeyRef,
      });

      // Single string output
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            id: 'job_string_output',
            status: 'succeeded',
            output: 'https://cdn.example.com/single.mp4',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const statusResult = await provider.checkStatus('job_string_output');
      expect(statusResult.status).toBe('completed');
      expect(statusResult.videoUrl).toBe('https://cdn.example.com/single.mp4');
    });

    it('3.8 ReplicateVideoRenderingProvider: error response trips circuit breaker and throws', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return new Response('Unauthorized key', { status: 401 });
      });

      const provider = new ReplicateVideoRenderingProvider({
        apiKey: 'r8_bad_key',
        keyRef: testKeyRef,
      });

      await expect(
        provider.renderVideo({
          faceUrl: 'https://cdn.example.com/face.png',
          audioUrl: 'https://cdn.example.com/audio.mp3',
        }),
      ).rejects.toThrow(/Replicate renderVideo failed: 401/);

      expect(shouldAllowRequest('replicate', testKeyRef)).toBe(false);

      // checkStatus also respects circuit breaker
      await expect(provider.checkStatus('some_job')).rejects.toThrow(
        /Circuit breaker open for replicate/,
      );
    });
  });
});
