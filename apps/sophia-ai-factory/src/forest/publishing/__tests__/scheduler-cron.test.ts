import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSchedulerCron } from '../scheduler';
import { inngest } from '@/seed/inngest/client';

const mockMocks = vi.hoisted(() => ({
  mockDb: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
  mockAtomicClaimJob: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue(mockMocks.mockDb),
  getD1: vi.fn(),
}));

vi.mock('@/land/video/publishing/publish-claim', () => ({
  atomicClaimJob: mockMocks.mockAtomicClaimJob,
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
    expect(mockMocks.mockAtomicClaimJob).not.toHaveBeenCalled();
  });

  it('claims and dispatches due jobs with OCC CAS', async () => {
    const dueJobs = [
      { id: 'job-1', tenant_id: 'tenant-1', channel_id: 'ch-1', scheduled_at: 900, status: 'scheduled' },
      { id: 'job-2', tenant_id: 'tenant-1', channel_id: 'ch-2', scheduled_at: 950, status: 'scheduled' },
    ];
    mockMocks.mockDb.limit.mockResolvedValueOnce({ data: dueJobs });
    mockMocks.mockAtomicClaimJob.mockResolvedValue({ claimed: true, status: 'uploading' });

    const res = await runSchedulerCron({ nowSec: 1000 });

    expect(res.processed).toBe(2);
    expect(res.dispatched).toEqual(['job-1', 'job-2']);
    expect(res.skipped).toBe(0);

    expect(mockMocks.mockAtomicClaimJob).toHaveBeenCalledTimes(2);
    expect(inngest.send).toHaveBeenCalledTimes(2);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'publish-job-1-due',
        name: 'publish.scheduled',
        data: expect.objectContaining({
          jobId: 'job-1',
          tenantId: 'tenant-1',
          alreadyClaimed: true,
        }),
      }),
    );
  });

  it('skips duplicate dispatches when another worker claims concurrently (claimed: false)', async () => {
    const dueJobs = [
      { id: 'job-claimed', tenant_id: 'tenant-1', channel_id: 'ch-1', scheduled_at: 900, status: 'scheduled' },
      { id: 'job-winner', tenant_id: 'tenant-1', channel_id: 'ch-2', scheduled_at: 950, status: 'scheduled' },
    ];
    mockMocks.mockDb.limit.mockResolvedValueOnce({ data: dueJobs });

    // First job fails CAS claim (claimed: false), second succeeds
    mockMocks.mockAtomicClaimJob
      .mockResolvedValueOnce({ claimed: false, status: 'uploading' })
      .mockResolvedValueOnce({ claimed: true, status: 'uploading' });

    const res = await runSchedulerCron({ nowSec: 1000 });

    expect(res.processed).toBe(2);
    expect(res.dispatched).toEqual(['job-winner']);
    expect(res.skipped).toBe(1);

    expect(inngest.send).toHaveBeenCalledTimes(1);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'publish-job-winner-due',
      }),
    );
  });
});
