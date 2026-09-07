/**
 * OpenRouterImageGenerationAdapter unit tests.
 *
 * Validates the ImageGenerationProvider interface contract:
 * - generate() happy path
 * - empty prompt rejection
 * - missing API key rejection
 * - circuit breaker open rejection
 * - capabilities() returns expected profile
 * - health() reflects circuit breaker state
 * - error classification (retryable vs non-retryable)
 * - aspect ratio mapping
 *
 * @module seed/ai/providers/__tests__/openrouter-image-generation-adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageGenerationError } from '../../image-generation-provider';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

const hoisted = vi.hoisted(() => ({
  chat: vi.fn(),
  shouldAllowRequest: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  MockAdapter: class {
    id = 'openrouter';
    label = 'OpenRouter Image Generation';
    apiKey: string | undefined;
    chat = hoisted.chat;
    constructor(config: { apiKey?: string } = {}) {
      this.apiKey = config.apiKey;
    }
  },
}));

vi.mock('../openrouter-image-adapter', () => ({
  OpenRouterImageAdapter: hoisted.MockAdapter,
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: hoisted.shouldAllowRequest,
  recordSuccess: hoisted.recordSuccess,
  recordFailure: hoisted.recordFailure,
}));

// Import after mocks are set up
import { OpenRouterImageGenerationAdapter } from '../openrouter-image-generation-adapter';

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('OpenRouterImageGenerationAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.shouldAllowRequest.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. generate() returns ImageGenerationResult on happy path', async () => {
    hoisted.chat.mockResolvedValue({
      content: 'data:image/png;base64,iVBORw0KGgo=',
      model: 'openai/dall-e-3',
      provider: 'openrouter',
      usage: { inputTokens: 10, outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: 5000,
      raw: { data: [{ b64_json: 'iVBORw0KGgo=' }] },
    });

    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    const result = await adapter.generate({ prompt: 'A sunset over mountains' });

    expect(result.assetRef).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(result.provider).toBe('openrouter-image');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata).toBeDefined();
    expect(hoisted.recordSuccess).toHaveBeenCalledWith('openrouter-image-generation');
  });

  it('2. generate() throws ImageGenerationError on empty prompt', async () => {
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    await expect(adapter.generate({ prompt: '' })).rejects.toThrow(ImageGenerationError);
    await expect(adapter.generate({ prompt: '   ' })).rejects.toThrow('EMPTY_PROMPT');
  });

  it('3. generate() throws ImageGenerationError when API key missing', async () => {
    const adapter = new OpenRouterImageGenerationAdapter();
    await expect(adapter.generate({ prompt: 'A cat' })).rejects.toThrow('MISSING_API_KEY');
  });

  it('4. generate() throws ImageGenerationError when circuit breaker open', async () => {
    hoisted.shouldAllowRequest.mockReturnValue(false);
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    await expect(adapter.generate({ prompt: 'A dog' })).rejects.toThrow('Circuit breaker open');
  });

  it('5. capabilities() returns expected profile', () => {
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    const caps = adapter.capabilities();
    expect(caps.supportsAspectRatio).toBe(true);
    expect(caps.supportsStyle).toBe(true);
    expect(caps.maxConcurrency).toBe(5);
  });

  it('6. health() returns healthy when circuit breaker allows', async () => {
    hoisted.shouldAllowRequest.mockReturnValue(true);
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    const health = await adapter.health();
    expect(health.healthy).toBe(true);
    expect(health.error).toBeUndefined();
  });

  it('7. health() returns unhealthy when circuit breaker open', async () => {
    hoisted.shouldAllowRequest.mockReturnValue(false);
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    const health = await adapter.health();
    expect(health.healthy).toBe(false);
    expect(health.error).toBe('Circuit breaker open');
  });

  it('8. generate() classifies 401 as non-retryable AUTH_FAILURE', async () => {
    hoisted.chat.mockRejectedValue(new Error('HTTP 401: unauthorized'));
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    await expect(adapter.generate({ prompt: 'A tree' })).rejects.toThrow(ImageGenerationError);
    try {
      await adapter.generate({ prompt: 'A tree' });
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenerationError);
      expect((err as ImageGenerationError).code).toBe('AUTH_FAILURE');
      expect((err as ImageGenerationError).retryable).toBe(false);
    }
  });

  it('9. generate() classifies 429 as retryable RATE_LIMIT', async () => {
    hoisted.chat.mockRejectedValue(new Error('HTTP 429: rate limit exceeded'));
    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });
    try {
      await adapter.generate({ prompt: 'A flower' });
    } catch (err) {
      expect(err).toBeInstanceOf(ImageGenerationError);
      expect((err as ImageGenerationError).code).toBe('RATE_LIMIT');
      expect((err as ImageGenerationError).retryable).toBe(true);
    }
  });

  it('10. generate() maps aspect ratios to sizes correctly', async () => {
    hoisted.chat.mockResolvedValue({
      content: 'data:image/png;base64,AAAA',
      model: 'openai/dall-e-3',
      provider: 'openrouter',
      usage: { inputTokens: 10, outputTokens: 0 },
      stopReason: 'end_turn',
      latencyMs: 100,
      raw: {},
    });

    const adapter = new OpenRouterImageGenerationAdapter({ apiKey: 'sk-test-key' });

    await adapter.generate({ prompt: 'Wide', aspectRatio: '16:9' });
    expect(hoisted.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ extraBody: expect.objectContaining({ size: '1792x1024' }) }),
    );

    await adapter.generate({ prompt: 'Tall', aspectRatio: '9:16' });
    expect(hoisted.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ extraBody: expect.objectContaining({ size: '1024x1792' }) }),
    );

    await adapter.generate({ prompt: 'Square', aspectRatio: '1:1' });
    expect(hoisted.chat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ extraBody: expect.objectContaining({ size: '1024x1024' }) }),
    );
  });
});
