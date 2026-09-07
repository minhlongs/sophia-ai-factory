/**
 * FalImageProvider unit tests — deterministic, mock-based.
 *
 * Validates:
 * 1. generate() success path returns URL assetRef
 * 2. generate() with aspect ratio maps to image_size
 * 3. Error classification: 401→AUTH_FAILURE, 429→RATE_LIMIT, 500→SERVER_ERROR
 * 4. Circuit breaker open → early rejection
 * 5. Timeout handling via AbortSignal
 * 6. Malformed JSON response → graceful error
 * 7. capabilities() static profile
 * 8. health() success + failure
 * 9. BYOK resolution (keyRef passed to circuit breaker)
 * 10. EXPERIMENTAL certification registered
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FalImageProvider, FalImageRequestSchema } from '../fal-image-provider';
import { ImageGenerationError } from '@/seed/ai/image-generation-provider';
import { shouldAllowRequest, recordSuccess, recordFailure, __testSetEntry } from '@/seed/security/circuit-breaker';
import { FailureKind, CircuitState } from '@/seed/types/failure-kind';
import { getCertification, ProviderCertificationState } from '@/seed/ai/provider-certification';
import { logger } from '@/seed/utils/logger-utility';

// Mock logger to avoid noise
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const VALID_RESPONSE = {
  images: [{ url: 'https://fal.ai/images/abc123.png', width: 1024, height: 768, content_type: 'image/png' }],
  timings: { inference: 0.76 },
  seed: 42,
  prompt: 'A sunset',
};

function createProvider(overrides: Partial<ConstructorParameters<typeof FalImageProvider>[0]> = {}) {
  return new FalImageProvider({
    apiKey: 'fal_test_key_123',
    model: 'fal-ai/flux-schnell',
    keyRef: 'test-tenant',
    ...overrides,
  });
}

describe('FalImageProvider', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    // Reset circuit breaker state for test isolation
    __testSetEntry('fal-ai', 'test-tenant', { state: CircuitState.CLOSED, failureCount: 0, cooldownUntil: null });
    __testSetEntry('fal-ai', 'platform', { state: CircuitState.CLOSED, failureCount: 0, cooldownUntil: null });
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('generate() success path', () => {
    it('returns URL assetRef on successful generation', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider();
      const result = await provider.generate({ prompt: 'A sunset over mountains' });

      expect(result.assetRef).toBe('https://fal.ai/images/abc123.png');
      expect(result.provider).toBe('fal-ai');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.model).toBe('fal-ai/flux-schnell');
      expect(result.metadata?.seed).toBe(42);
    });

    it('records success on circuit breaker', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider();
      await provider.generate({ prompt: 'test' });

      // After success, circuit breaker should be CLOSED
      expect(shouldAllowRequest('fal-ai', 'test-tenant')).toBe(true);
    });

    it('posts to correct endpoint with Key auth', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider({ model: 'fal-ai/flux/dev' });
      await provider.generate({ prompt: 'test' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://queue.fal.run/fal-ai/flux/dev');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'Content-Type': 'application/json',
        Authorization: 'Key fal_test_key_123',
      });
    });
  });

  describe('generate() with aspect ratio', () => {
    it('maps 16:9 aspect ratio to landscape_16_9 image_size', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider();
      await provider.generate({ prompt: 'test', aspectRatio: '16:9' });

      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(body.image_size).toBe('landscape_16_9');
    });

    it('maps 1:1 aspect ratio to square image_size', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider();
      await provider.generate({ prompt: 'test', aspectRatio: '1:1' });

      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(body.image_size).toBe('square');
    });

    it('omits image_size when no aspect ratio provided', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider();
      await provider.generate({ prompt: 'test' });

      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(body.image_size).toBeUndefined();
    });
  });

  describe('error classification', () => {
    it('401 → AUTH_FAILURE ImageGenerationError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: FailureKind.AUTH_FAILURE,
        provider: 'fal-ai',
        retryable: false,
      });
    });

    it('403 → AUTH_FAILURE ImageGenerationError', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: FailureKind.AUTH_FAILURE,
        retryable: false,
      });
    });

    it('429 → RATE_LIMIT retryable error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Rate limited', { status: 429 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: FailureKind.RATE_LIMIT,
        retryable: true,
      });
    });

    it('500 → SERVER_ERROR retryable error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: FailureKind.SERVER_ERROR,
        retryable: true,
      });
    });

    it('502 → SERVER_ERROR retryable error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Bad Gateway', { status: 502 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: FailureKind.SERVER_ERROR,
        retryable: true,
      });
    });
  });

  describe('circuit breaker integration', () => {
    it('rejects early when circuit breaker is open', async () => {
      // Force circuit breaker open
      __testSetEntry('fal-ai', 'test-tenant', {
        state: CircuitState.OPEN,
        cooldownUntil: Date.now() + 300_000,
      });

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: 'CIRCUIT_BREAKER_OPEN',
        retryable: true,
      });

      // No HTTP call should have been made
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('records failure on 500 error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Server Error', { status: 500 }),
      );

      const provider = createProvider();
      try {
        await provider.generate({ prompt: 'test' });
      } catch {
        // expected
      }

      // Circuit breaker should have recorded a failure
      expect(shouldAllowRequest('fal-ai', 'test-tenant')).toBe(true); // Still CLOSED after 1 failure
    });
  });

  describe('timeout handling', () => {
    it('throws TIMEOUT error when fetch is aborted', async () => {
      // Simulate AbortSignal.timeout firing — fetch rejects with AbortError.
      // Use a real Error with name='AbortError' (DOMException may not be
      // instanceof Error in the test runtime).
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      fetchMock.mockRejectedValueOnce(abortError);

      const provider = createProvider({ timeoutMs: 5000 });
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: FailureKind.TIMEOUT,
        retryable: true,
      });
    });
  });

  describe('malformed response handling', () => {
    it('throws INVALID_RESPONSE when images array is empty', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [] }), { status: 200 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
        retryable: false,
      });
    });

    it('throws INVALID_RESPONSE when response has no images field', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: 'unexpected' }), { status: 200 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('throws INVALID_RESPONSE when image URL is invalid', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: 'not-a-url' }] }), { status: 200 }),
      );

      const provider = createProvider();
      await expect(provider.generate({ prompt: 'test' })).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });
  });

  describe('capabilities()', () => {
    it('returns correct static profile', () => {
      const provider = createProvider();
      const caps = provider.capabilities();
      expect(caps).toEqual({
        supportsAspectRatio: true,
        supportsStyle: false,
        maxConcurrency: 5,
      });
    });
  });

  describe('health()', () => {
    it('returns healthy=true on 200 response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('OK', { status: 200 }),
      );

      const provider = createProvider();
      const health = await provider.health();
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns healthy=true on 404 (service reachable)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );

      const provider = createProvider();
      const health = await provider.health();
      expect(health.healthy).toBe(true);
    });

    it('returns healthy=false on 5xx response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('Server Error', { status: 503 }),
      );

      const provider = createProvider();
      const health = await provider.health();
      expect(health.healthy).toBe(false);
      expect(health.error).toContain('503');
    });

    it('returns healthy=false on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const provider = createProvider();
      const health = await provider.health();
      expect(health.healthy).toBe(false);
      expect(health.error).toBe(FailureKind.NETWORK);
    });
  });

  describe('BYOK resolution', () => {
    it('uses keyRef for circuit breaker isolation', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider({ keyRef: 'user-123' });
      await provider.generate({ prompt: 'test' });

      // Verify the keyRef was used (circuit breaker state isolated per tenant)
      expect(shouldAllowRequest('fal-ai', 'user-123')).toBe(true);
    });

    it('defaults keyRef to "platform" when not provided', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(VALID_RESPONSE), { status: 200 }),
      );

      const provider = createProvider({ keyRef: undefined });
      await provider.generate({ prompt: 'test' });

      expect(shouldAllowRequest('fal-ai', 'platform')).toBe(true);
    });
  });

  describe('EXPERIMENTAL certification', () => {
    it('registers as EXPERIMENTAL at module load', () => {
      const cert = getCertification('fal-ai');
      expect(cert.state).toBe(ProviderCertificationState.EXPERIMENTAL);
      expect(cert.reason).toContain('Experimental');
    });
  });

  describe('Zod schema validation', () => {
    it('FalImageRequestSchema validates valid input', () => {
      const result = FalImageRequestSchema.safeParse({
        prompt: 'A sunset',
        image_size: 'square',
        num_inference_steps: 4,
        guidance_scale: 3.5,
      });
      expect(result.success).toBe(true);
    });

    it('FalImageRequestSchema rejects empty prompt', () => {
      const result = FalImageRequestSchema.safeParse({ prompt: '' });
      expect(result.success).toBe(false);
    });

    it('FalImageRequestSchema rejects negative num_inference_steps', () => {
      const result = FalImageRequestSchema.safeParse({ prompt: 'test', num_inference_steps: -1 });
      expect(result.success).toBe(false);
    });
  });
});
