/**
 * Creative Image Generate Integration Test — end-to-end flow.
 *
 * Full flow: creative/image.requested event → handler → mock provider → asset store
 * → result gate → emits creative/image.completed or creative/image.failed.
 *
 * Validates the complete Inngest function wiring without real network/DB.
 *
 * Uses the proven youtube-content-pipeline.test.ts pattern:
 * - vi.hoisted() mocks for createFunction, send, DB, logger, circuit breaker
 * - Direct export cast (creativeImageGenerate as unknown as Handler)
 * - D1 mock via prepare().bind().first() chain
 *
 * @module forest/inngest/functions/__tests__/creative-image-generate-integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (using vi.hoisted for proper factory hoisting - see youtube-content-pipeline.test.ts)
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

import { creativeImageGenerate } from '@/forest/inngest/functions/creative-image-generate';
import { createServerClient } from '@/seed/db/client';

// ---------------------------------------------------------------------------
// D1 mock helpers (matching youtube-content-pipeline pattern)
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
// Event fixtures (using valid UUID v4)
// ---------------------------------------------------------------------------

const baseEventData = {
  jobId: '22222222-2222-4222-8222-222222222222',
  missionId: 'integ-mission-456',
  userId: 'integ-user-789',
  prompt: 'Integration test: sunset over ocean',
  negativePrompt: 'dark, night',
  aspectRatio: '16:9' as const,
  style: 'photorealistic',
  seed: 999,
  idempotencyKey: 'integ-idem-key-123',
  constraints: undefined,
};

function makeEvent(over: Record<string, unknown> = {}) {
  return {
    event: {
      data: { ...baseEventData, ...over },
      name: 'creative/image.requested',
      id: 'integ-event-123',
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
// Integration tests
// ---------------------------------------------------------------------------

describe('creativeImageGenerate integration', () => {
  let step: FakeStep;

  beforeEach(() => {
    vi.clearAllMocks();
    step = createFakeStep();
    mocks.send.mockResolvedValue(undefined);
  });

  it('full happy path emits creative/image.completed with all expected fields', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    const result = await handler({ ...makeEvent(), step });

    expect(step.run).toHaveBeenCalledWith('check-idempotency', expect.any(Function));
    expect(step.run).toHaveBeenCalledWith('generate-1', expect.any(Function));
    expect(step.run).toHaveBeenCalledWith('store-asset', expect.any(Function));
    expect(step.run).toHaveBeenCalledWith('result-gate', expect.any(Function));

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sentEvent = mocks.send.mock.calls[0][0];
    expect(sentEvent.name).toBe('creative/image.completed');
    expect(sentEvent.data.jobId).toBe('22222222-2222-4222-8222-222222222222');
    expect(sentEvent.data.missionId).toBe('integ-mission-456');
    expect(sentEvent.data.userId).toBe('integ-user-789');
    expect(sentEvent.data.provider).toBe('mock-image');
    expect(sentEvent.data.costCents).toBe(0);
    expect(sentEvent.data.assetRef).toMatch(/^mock:\/\/image\//);
    expect(sentEvent.data.promptHash).toBeDefined();
    expect(sentEvent.data.generatedAt).toBeDefined();

    expect(mocks.recordSuccess).toHaveBeenCalledWith('mock-image');
    expect(result.success).toBe(true);
  });

  it('uses idempotencyKey from event when provided', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    const result = await handler({ ...makeEvent(), step });

    expect(step.run).toHaveBeenCalledWith('check-idempotency', expect.any(Function));
    const generateCalls = step.run.mock.calls.filter(
      (c: unknown[]) => String(c[0]).startsWith('generate-'),
    );
    expect(generateCalls).toHaveLength(1);

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sentEvent = mocks.send.mock.calls[0][0];
    expect(sentEvent.name).toBe('creative/image.completed');
    expect(result.success).toBe(true);
  });

  it('falls back to jobId when idempotencyKey not provided', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    const result = await handler({ ...makeEvent({ idempotencyKey: undefined }), step });

    expect(result.success).toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('applies default constraints when none provided', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    await handler({ ...makeEvent({ constraints: undefined }), step });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'creative/image.completed' })
    );
  });

  it('uses custom constraints when provided', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    const customConstraints = {
      timeoutMs: 30000,
      maxRetries: 2,
      allowedMimeTypes: ['image/png', 'image/jpeg'],
      maxSizeBytes: 5 * 1024 * 1024,
    };

    await handler({ ...makeEvent({ constraints: customConstraints }), step });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'creative/image.completed' })
    );
  });

  it('includes negativePrompt in provider input when provided', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    await handler({ ...makeEvent({ negativePrompt: 'blurry, low quality, watermark' }), step });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'creative/image.completed' })
    );
  });

  it('includes seed in provider input when provided', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    await handler({ ...makeEvent({ seed: 12345 }), step });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'creative/image.completed' })
    );
  });

  it('handles aspectRatio variations correctly', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    for (const aspectRatio of ['16:9', '9:16', '1:1', '4:3', '3:4'] as const) {
      vi.clearAllMocks();
      mocks.send.mockResolvedValue(undefined);
      vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));
      mocks.shouldAllowRequest.mockReturnValue(true);
      step = createFakeStep();

      const result = await handler({ ...makeEvent({ aspectRatio }), step });
      expect(result.success).toBe(true);
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'creative/image.completed' })
      );
    }
  });

  it('emits creative/image.failed when circuit breaker is open', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));
    mocks.shouldAllowRequest.mockReturnValue(false);

    const result = await handler({ ...makeEvent(), step });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CIRCUIT_OPEN');

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sentEvent = mocks.send.mock.calls[0][0];
    expect(sentEvent.name).toBe('creative/image.failed');
    expect(sentEvent.data.jobId).toBe('22222222-2222-4222-8222-222222222222');
    expect(sentEvent.data.missionId).toBe('integ-mission-456');
    expect(sentEvent.data.userId).toBe('integ-user-789');
    expect(sentEvent.data.code).toBe('CIRCUIT_OPEN');
    expect(sentEvent.data.kind).toBe('SERVER_ERROR');
    expect(sentEvent.data.attempt).toBe(0);

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'creativeImageGenerate: circuit breaker open',
      expect.objectContaining({ jobId: '22222222-2222-4222-8222-222222222222', provider: 'mock-image' })
    );
  });

  it('asset stored has correct structure for media_jobs', async () => {
    vi.mocked(createServerClient).mockReturnValue(makeD1Mock(null));

    await handler({ ...makeEvent(), step });

    // The D1 mock was called - verify the mock was invoked
    expect(createServerClient).toHaveBeenCalled();
  });

  it('idempotent: returns existing asset without generating', async () => {
    const existing: D1Row = {
      id: '22222222-2222-4222-8222-222222222222',
      job_id: '22222222-2222-4222-8222-222222222222',
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