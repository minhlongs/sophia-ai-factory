import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSchedulerCron } from '../scheduler';
import { inngest } from '@/seed/inngest/client';
import { SYSTEM_REQUESTER_SENTINEL, toRequesterId } from '@/tree/publishing/approval';

const mockMocks = vi.hoisted(() => ({
  mockDb: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue(mockMocks.mockDb),
  getD1: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('runSchedulerCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMocks.mockDb.from.mockReturnThis();
    mockMocks.mockDb.select.mockReturnThis();
    mockMocks.mockDb.eq.mockReturnThis();
    mockMocks.mockDb.lte.mockReturnThis();
    mockMocks.mockDb.order.mockReturnThis();
    mockMocks.mockDb.limit.mockReturnThis();
  });

  it('returns zero when no due jobs exist', async () => {
    mockMocks.mockDb.limit.mockResolvedValueOnce({ data: [] });

    const res = await runSchedulerCron({ nowSec: 1000 });
    expect(res).toEqual({ processed: 0, dispatched: [], skipped: 0 });
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('dispatches due jobs while leaving the worker to claim them', async () => {
    const dueJobs = [
      { id: 'job-1', tenant_id: 'tenant-1', channel_id: 'ch-1', scheduled_at: 900, status: 'scheduled' },
      { id: 'job-2', tenant_id: 'tenant-1', channel_id: 'ch-2', scheduled_at: 950, status: 'scheduled' },
    ];
    mockMocks.mockDb.limit.mockResolvedValueOnce({ data: dueJobs });

    const res = await runSchedulerCron({ nowSec: 1000 });

    expect(res.processed).toBe(2);
    expect(res.dispatched).toEqual(['job-1', 'job-2']);
    expect(res.skipped).toBe(0);

    expect(inngest.send).toHaveBeenCalledTimes(2);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'publish-job-1-due',
        name: 'publish.scheduled',
        data: {
          jobId: 'job-1',
          tenantId: 'tenant-1',
          userId: SYSTEM_REQUESTER_SENTINEL,
        },
      }),
    );

    const firstArg = vi.mocked(inngest.send).mock.calls[0]?.[0];
    const emittedUserId =
      firstArg && !Array.isArray(firstArg) && firstArg.name === 'publish.scheduled'
        ? firstArg.data.userId
        : undefined;
    expect(emittedUserId).toBe(SYSTEM_REQUESTER_SENTINEL);
    expect(emittedUserId).not.toBe('tenant-1');
    expect(toRequesterId(emittedUserId)).toBeUndefined();
  });

  it('leaves a job eligible for the next cron when event dispatch fails', async () => {
    const dueJob = {
      id: 'job-retryable',
      tenant_id: 'tenant-1',
      channel_id: 'ch-1',
      scheduled_at: 900,
      status: 'scheduled',
    };
    mockMocks.mockDb.limit.mockResolvedValue({ data: [dueJob] });
    vi.mocked(inngest.send)
      .mockRejectedValueOnce(new Error('dispatch unavailable'))
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof inngest.send>>);

    await expect(runSchedulerCron({ nowSec: 1000 })).rejects.toThrow('dispatch unavailable');
    const retried = await runSchedulerCron({ nowSec: 1000 });

    expect(retried.dispatched).toEqual(['job-retryable']);
    expect(mockMocks.mockDb.from).toHaveBeenCalledTimes(2);
    expect(inngest.send).toHaveBeenCalledTimes(2);
    expect(inngest.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'publish-job-retryable-due' }),
    );
  });
});
