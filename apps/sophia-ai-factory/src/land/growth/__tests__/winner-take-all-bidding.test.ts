import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeWinnerTakeAllBidding } from '../winner-take-all-bidding';
import {
  computeWtaCompositeScore,
  evaluateWtaBiddingHold,
  rankWtaJobsByTelemetry,
  type WtaJobTelemetryRow,
} from '../wta-telemetry-scorer';
import { createServerClient } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { inngest } from '@/seed/inngest/client';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn().mockResolvedValue('PREMIUM'),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

function makeRow(overrides: Partial<WtaJobTelemetryRow> & { id: string }): WtaJobTelemetryRow {
  return {
    prompt: `prompt-${overrides.id}`,
    createdAt: 1000,
    views: 0,
    completionRate: 0,
    clicks: 0,
    likes: 0,
    shares: 0,
    ...overrides,
  };
}

describe('executeWinnerTakeAllBidding & WTA telemetry scorer', () => {
  const origEnv = { ...process.env };
  const mockDbParams = {
    all: vi.fn(),
    run: vi.fn(),
  };
  const mockBind = vi.fn(() => mockDbParams);
  const mockPrepare = vi.fn(() => ({
    bind: mockBind,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SOPHIA_EDITION;
    vi.mocked(getUserTier).mockResolvedValue('PREMIUM');
    (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prepare: mockPrepare,
    });
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('denies execution with FEATURE_LOCKED on community self-host edition', async () => {
    process.env.SOPHIA_EDITION = 'community';
    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-123',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FEATURE_LOCKED');
    }
    expect(mockPrepare).not.toHaveBeenCalled();
  });

  it('holds culling and duplication when cohort has fewer than 5 published jobs', async () => {
    const sparseJobs = [
      makeRow({ id: 'job-1', views: 500, clicks: 20 }),
      makeRow({ id: 'job-2', views: 300, clicks: 10 }),
      makeRow({ id: 'job-3', views: 100, clicks: 2 }),
      makeRow({ id: 'job-4', views: 50, clicks: 0 }),
    ];
    mockDbParams.all.mockResolvedValueOnce({ success: true, results: sparseJobs });

    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-123',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.culledCount).toBe(0);
      expect(result.value.duplicatedCount).toBe(0);
      expect(result.value.heldBySparseData).toBe(true);
    }
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('holds culling and duplication when sparseData triggers Track B Sparse-Data Hold', async () => {
    const jobs = [1, 2, 3, 4, 5].map((n) => makeRow({ id: `job-${n}`, views: n * 100 }));
    mockDbParams.all.mockResolvedValueOnce({ success: true, results: jobs });

    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-123',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
      sparseData: {
        monthlyVerifiedConversions: 4,
        variantImpressions: [300, 450, 500],
        accountAgeDays: 12,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.culledCount).toBe(0);
      expect(result.value.duplicatedCount).toBe(0);
      expect(result.value.heldBySparseData).toBe(true);
    }
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it('ranks by real telemetry score, culls bottom 80% with parameterized SQL, and duplicates top 20%', async () => {
    const jobs: WtaJobTelemetryRow[] = [
      makeRow({ id: 'job-low-1', views: 10, completionRate: 0.2, clicks: 0, likes: 0, shares: 0 }),
      makeRow({ id: 'job-low-2', views: 25, completionRate: 0.3, clicks: 1, likes: 1, shares: 0 }),
      makeRow({ id: 'job-winner', views: 1000, completionRate: 0.85, clicks: 45, likes: 120, shares: 30 }),
      makeRow({ id: 'job-low-3', views: 40, completionRate: 0.4, clicks: 2, likes: 3, shares: 0 }),
      makeRow({ id: 'job-low-4', views: 5, completionRate: 0.1, clicks: 0, likes: 0, shares: 0 }),
    ];
    mockDbParams.all.mockResolvedValueOnce({ success: true, results: jobs });
    mockDbParams.run.mockResolvedValueOnce({ success: true });

    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-123',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.culledCount).toBe(4);
      expect(result.value.duplicatedCount).toBe(1);
    }

    expect(mockPrepare).toHaveBeenCalledTimes(2);
    const selectSql = String((mockPrepare.mock.calls as unknown[][])[0]?.[0] ?? '');
    const updateSql = String((mockPrepare.mock.calls as unknown[][])[1]?.[0] ?? '');
    expect(selectSql).toContain('WITH latest_va AS');
    expect(selectSql).toContain('lva.user_id = vj.user_id');
    expect(updateSql).toContain('id IN (?, ?, ?, ?)');

    const sendOrder = vi.mocked(inngest.send).mock.invocationCallOrder[0] ?? 0;
    const runOrder = mockDbParams.run.mock.invocationCallOrder[0] ?? 0;
    expect(sendOrder).toBeGreaterThan(0);
    expect(sendOrder).toBeLessThan(runOrder);

    const updateBindArgs = (mockBind.mock.calls as unknown[][])[1] ?? [];
    expect(updateBindArgs.slice(1)).toEqual([
      'tenant-123',
      'job-low-3',
      'job-low-2',
      'job-low-1',
      'job-low-4',
    ]);

    expect(inngest.send).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'video/generate.requested',
        data: expect.objectContaining({
          missionId: expect.stringContaining('_job-winner'),
          tenantId: 'tenant-123',
          userId: 'user-123',
          prompt: 'prompt-job-winner',
          voiceoverText: 'prompt-job-winner',
          language: 'vi',
        }),
      }),
    ]);
  });

  it('chunks parameterized D1 cull updates into batches of <= 80 IDs', async () => {
    const largeCohort: WtaJobTelemetryRow[] = Array.from({ length: 105 }, (_, idx) =>
      makeRow({
        id: `job-${String(idx).padStart(3, '0')}`,
        views: 1000 - idx,
        completionRate: 0.5,
      }),
    );
    mockDbParams.all.mockResolvedValueOnce({ success: true, results: largeCohort });
    mockDbParams.run.mockResolvedValue({ success: true });

    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-chunk',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.duplicatedCount).toBe(21);
      expect(result.value.culledCount).toBe(84);
    }
    expect(mockDbParams.run).toHaveBeenCalledTimes(2);
    const chunk1Args = (mockBind.mock.calls as unknown[][])[1] ?? [];
    const chunk2Args = (mockBind.mock.calls as unknown[][])[2] ?? [];
    expect(chunk1Args.slice(2)).toHaveLength(80);
    expect(chunk2Args.slice(2)).toHaveLength(4);
  });

  it('breaks ties deterministically by createdAt DESC then ASCII id ASC', () => {
    const tied = rankWtaJobsByTelemetry([
      makeRow({ id: 'job-b', createdAt: 2000, views: 100, completionRate: 0.5 }),
      makeRow({ id: 'job-a', createdAt: 2000, views: 100, completionRate: 0.5 }),
      makeRow({ id: 'job-old', createdAt: 1000, views: 100, completionRate: 0.5 }),
    ]);

    expect(tied.map((r) => r.id)).toEqual(['job-a', 'job-b', 'job-old']);
    expect(computeWtaCompositeScore(tied[0])).toBeCloseTo(150, 5);
    expect(evaluateWtaBiddingHold(5).hold).toBe(false);
  });
});
