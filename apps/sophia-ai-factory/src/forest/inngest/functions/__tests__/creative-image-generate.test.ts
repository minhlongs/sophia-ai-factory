/**
 * Creative Image Generate Inngest Function — unit tests.
 *
 * Uses the proven youtube-content-pipeline.test.ts pattern:
 * - vi.hoisted() mocks for createFunction, send, DB, logger, circuit breaker
 * - Direct export cast (creativeImageGenerate as unknown as Handler)
 * - D1 mock via prepare().bind().first() chain (not createServerClient chain mock)
 *
 * @module forest/inngest/functions/__tests__/creative-image-generate
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const captured: { cfg?: unknown; evt?: unknown } = {};
  const createFunction = vi.fn((_cfg: unknown, _evt: unknown, handler: unknown) => {
    captured.cfg = _cfg;
    captured.evt = _evt;
    return handler;
  });
  return {
    captured,
    createFunction,
    send: vi.fn().mockResolvedValue(undefined),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    shouldAllowRequest: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  };
});

vi.mock('@/seed/inngest/client', () => ({
  inngest: { createFunction: mocks.createFunction, send: mocks.send },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: mocks.shouldAllowRequest,
  recordSuccess: mocks.recordSuccess,
  recordFailure: mocks.recordFailure,
}));

import { creativeImageGenerate, resolveImageProvider } from '@/forest/inngest/functions/creative-image-generate';
import { createServerClient } from '@/seed/db/client';
import { OpenRouterImageGenerationAdapter } from '@/seed/ai/providers/openrouter-image-generation-adapter';

// ---------------------------------------------------------------------------
// D1 mock helpers
// ---------------------------------------------------------------------------

interface D1Row {
  id: string;
  job_id: string;
  url: string;
  mime: string;
  size: number;
  provider: string;
  prompt_hash: string;
  generated_at: string;
}

function makeD1Mock(row: D1Row | null) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => row,
        run: async () => ({ success: true, meta: { changes: 1, duration_ms: 0 } }),
      }),
    }),
  } as unknown as ReturnType<typeof createServerClient>;
}

// ---------------------------------------------------------------------------
// Step mock
// ---------------------------------------------------------------------------

interface FakeStep {
  run: ReturnType<typeof vi.fn>;
  sleep: ReturnType<typeof vi.fn>;
}

function createFakeStep(): FakeStep {
  return {
    run: vi.fn().mockImplementation(async (_name: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Event fixtures
// ---------------------------------------------------------------------------

const baseEventData = {
  jobId: '11111111-1111-4111-8111-111111111111',
  missionId: 'mission-456',
  userId: 'user-789',
  prompt: 'A beautiful sunset over mountains',
  negativePrompt: 'blurry, low quality',
  aspectRatio: '16:9' as const,
  style: 'cinematic',
  seed: 42,
  idempotencyKey: 'idem-key-123',
  constraints: undefined,
};

function makeEvent(over: Record<string, unknown> = {}) {
  return {
    event: {
      data: { ...baseEventData, ...over },
      name: 'creative/image.requested',
      id: 'event-123',
      ts: 1234567890,
    },
  };
}

// ---------------------------------------------------------------------------
// Handler type
// ---------------------------------------------------------------------------

type Handler = (ctx: {
  event: { data: Record<string, unknown> };
  step: FakeStep;
}) => Promise<{ success: boolean; data?: Record<string, unknown>; error?: Record<string, unknown> }>;

const handler = creativeImageGenerate as unknown as Handler;

// ---------------------------------------------------------------------------
// Configuration tests
// ---------------------------------------------------------------------------

describe('function configuration', () => {
  it('registers with id creative-image-generate and retries 3', () => {
    const cfg = mocks.captured.cfg as { id: string; retries: number };
    expect(cfg.id).toBe('creative-image-generate');
    expect(cfg.retries).toBe(3);
  });

  it('listens for creative/image.requested', () => {
    const trigger = mocks.captured.evt as { event: string };
    expect(trigger.event).toBe('creative/image.requested');
  });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('creativeImageGenerate', () => {
  let step: FakeStep;

  beforeEach(() => {
    vi.clearAllMocks();
    step = createFakeStep();
    mocks.send.mockResolvedValue(undefined);
    // prepare is set per-test via makeD1Mock
  });

  it('happy path: emits creative/image.completed', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    const result = await handler({ ...makeEvent(), step });

    expect(step.run).toHaveBeenCalledWith('check-idempotency', expect.any(Function));
    expect(step.run).toHaveBeenCalledWith('generate-1', expect.any(Function));
    expect(step.run).toHaveBeenCalledWith('store-asset', expect.any(Function));
    expect(step.run).toHaveBeenCalledWith('result-gate', expect.any(Function));

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sentEvent = mocks.send.mock.calls[0][0];
    expect(sentEvent.name).toBe('creative/image.completed');
    expect(sentEvent.data.jobId).toBe('11111111-1111-4111-8111-111111111111');
    expect(sentEvent.data.missionId).toBe('mission-456');
    expect(sentEvent.data.userId).toBe('user-789');
    expect(sentEvent.data.provider).toBe('mock-image');
    expect(sentEvent.data.costCents).toBe(0);

    expect(mocks.recordSuccess).toHaveBeenCalledWith('mock-image');
    expect(result.success).toBe(true);
  });

  it('idempotent: returns existing asset without generating', async () => {
    const existing: D1Row = {
      id: 'job-123',
      job_id: 'job-123',
      url: 'mock://image/existing.png',
      mime: 'image/png',
      size: 1024,
      provider: 'mock-image',
      prompt_hash: 'abc123',
      generated_at: '2026-09-06T00:00:00Z',
    };
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(existing));

    const result = await handler({ ...makeEvent(), step });

    expect(step.run).toHaveBeenCalledWith('check-idempotency', expect.any(Function));
    const generateCalls = step.run.mock.calls.filter(
      (c: unknown[]) => String(c[0]).startsWith('generate-'),
    );
    expect(generateCalls).toHaveLength(0);

    expect(mocks.send).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data?.idempotent).toBe(true);
  });

  it('circuit breaker open: emits creative/image.failed with CIRCUIT_OPEN', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));
    mocks.shouldAllowRequest.mockReturnValue(false);

    const result = await handler({ ...makeEvent(), step });

    expect(step.run).toHaveBeenCalledWith('check-idempotency', expect.any(Function));
    const generateCalls = step.run.mock.calls.filter(
      (c: unknown[]) => String(c[0]).startsWith('generate-'),
    );
    expect(generateCalls).toHaveLength(0);

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sentEvent = mocks.send.mock.calls[0][0];
    expect(sentEvent.name).toBe('creative/image.failed');
    expect(sentEvent.data.code).toBe('CIRCUIT_OPEN');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'creativeImageGenerate: circuit breaker open',
      expect.objectContaining({ jobId: '11111111-1111-4111-8111-111111111111', provider: 'mock-image' }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CIRCUIT_OPEN');
  });

  it('provider failure: retries and emits creative/image.failed after exhaustion', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));
    mocks.shouldAllowRequest.mockReturnValue(true);

    step.run = vi.fn().mockImplementation(async (name: string, fn: () => Promise<unknown>) => {
      if (String(name).startsWith('generate-')) {
        throw new Error('Provider exploded');
      }
      return fn();
    });

    const result = await handler({ ...makeEvent(), step });

    expect(step.run).toHaveBeenCalledTimes(4);
    const generateCalls = step.run.mock.calls.filter(
      (c: unknown[]) => String(c[0]).startsWith('generate-'),
    );
    expect(generateCalls).toHaveLength(3);

    expect(step.sleep).toHaveBeenCalledTimes(2);

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sentEvent = mocks.send.mock.calls[0][0];
    expect(sentEvent.name).toBe('creative/image.failed');
    expect(sentEvent.data.code).toBe('MAX_RETRIES_EXCEEDED');

    expect(mocks.recordFailure).toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('MAX_RETRIES_EXCEEDED');
  });
});

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

describe('resolveImageProvider', () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPENROUTER_API_KEY = originalKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
  });

  it('returns OpenRouterImageGenerationAdapter when OPENROUTER_API_KEY is set', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-key';
    const provider = resolveImageProvider();
    expect(provider).toBeInstanceOf(OpenRouterImageGenerationAdapter);
    expect(provider.id).toBe('openrouter-image');
  });

  it('returns InlineMockImageProvider when OPENROUTER_API_KEY is absent', () => {
    delete process.env.OPENROUTER_API_KEY;
    const provider = resolveImageProvider();
    expect(provider).not.toBeInstanceOf(OpenRouterImageGenerationAdapter);
    expect(provider.id).toBe('mock-image');
  });
});
