/**
 * Unit Tests for Growth v12 Reseed Worker
 * Layer: forest/growth/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { growthV12ReseedWorker } from '../growth-v12-reseed-worker';

const { mockInngestSend } = vi.hoisted(() => ({
  mockInngestSend: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: mockInngestSend,
    createFunction: (
      _cfg: unknown,
      _evt: unknown,
      handler: (...args: unknown[]) => unknown,
    ) => handler,
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('growthV12ReseedWorker Inngest Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStep = {
    run: vi.fn().mockImplementation((_name, fn) => fn()),
  };

  it('rejects invalid trigger payloads', async () => {
    // Missing required fields
    const handler = growthV12ReseedWorker as unknown as (args: { event: { data: unknown }; step: typeof mockStep }) => Promise<{ success: boolean; reason?: string }>;
    const res = await handler({
      event: { data: { invalid: true } },
      step: mockStep,
    });

    expect(res.success).toBe(false);
    expect(res.reason).toBe('INVALID_PAYLOAD');
  });

  it('successfully processes valid viral reseed trigger and dispatches generation event', async () => {
    const validData = {
      userId: 'user_123',
      sourceJobId: 'job_src_999',
      channelId: 'chan_yt_1',
      platform: 'YOUTUBE_SHORTS',
      originalHook: 'Top 5 AI tools that make passive income',
      retentionZScore: 2.1,
      classification: 'ALPHA_VIRAL',
      mutatedHooks: [
        'Bí mật mà chuyên gia không muốn bạn biết: Top 5 AI tools',
      ],
    };

    const handler = growthV12ReseedWorker as unknown as (args: { event: { data: unknown }; step: typeof mockStep }) => Promise<{ success: boolean; sourceJobId: string }>;
    const res = await handler({
      event: { data: validData },
      step: mockStep,
    });

    expect(res.success).toBe(true);
    expect(res.sourceJobId).toBe('job_src_999');
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'video/generate.requested',
        data: expect.objectContaining({
          userId: 'user_123',
          missionId: 'job_src_999',
          prompt: expect.stringContaining('[Reseed]'),
        }),
      }),
    );
  });
});
