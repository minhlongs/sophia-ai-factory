import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockDb: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({}),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockReturnValue({ prepare: vi.fn() }),
  createServerClient: vi.fn().mockReturnValue(mocks.mockDb),
}));

vi.mock('../per-channel-quota', () => ({
  consumeQuota: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
}));

vi.mock('@/forest/quota/channel-cooldown', () => ({
  checkCooldown: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/forest/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({}),
  },
}));

import { schedulePublish, getOptimalPublishTime } from '../scheduler';

const mockSelectResult = {
  data: [
    { id: 'ch1', tenant_id: 't1', provider: 'youtube', status: 'active' },
    { id: 'ch2', tenant_id: 't1', provider: 'tiktok', status: 'active' },
  ],
};

describe('scheduler - getOptimalPublishTime', () => {
  it('snaps to next optimal time on same day', () => {
    const scheduledAt = Date.UTC(2026, 4, 25, 10, 0, 0) / 1000;
    const optimal = getOptimalPublishTime(scheduledAt, 'UTC');
    const expected = Date.UTC(2026, 4, 25, 12, 30, 0) / 1000;
    expect(optimal).toBe(expected);
  });

  it('snaps to next day if current time is after all peak hours', () => {
    const scheduledAt = Date.UTC(2026, 4, 25, 22, 0, 0) / 1000;
    const optimal = getOptimalPublishTime(scheduledAt, 'UTC');
    const expected = Date.UTC(2026, 4, 26, 8, 0, 0) / 1000;
    expect(optimal).toBe(expected);
  });

  it('handles target timezone conversion correctly', () => {
    const scheduledAt = Date.UTC(2026, 4, 25, 14, 0, 0) / 1000;
    const optimal = getOptimalPublishTime(scheduledAt, 'America/New_York');
    const expected = Date.UTC(2026, 4, 25, 16, 30, 0) / 1000;
    expect(optimal).toBe(expected);
  });
});

describe('scheduler - schedulePublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDb.from.mockReturnThis();
    mocks.mockDb.select.mockReturnThis();
    mocks.mockDb.eq.mockReturnThis();
    mocks.mockDb.in.mockReturnThis();
    mocks.mockDb.gte.mockReturnThis();
    mocks.mockDb.lte.mockReturnThis();
  });

  it('schedules publishing jobs with staggering and anti-collision checks', async () => {
    mocks.mockDb.in.mockResolvedValueOnce(mockSelectResult);
    mocks.mockDb.lte.mockResolvedValue({ data: [] });

    const scheduledAt = Date.UTC(2026, 4, 25, 10, 0, 0) / 1000;

    const input = {
      videoJobId: 'v1',
      tenantId: 't1',
      userId: 'u1',
      channelIds: ['ch1', 'ch2'],
      caption: 'Test caption',
      hashtags: ['test'],
      scheduledAt,
      staggerMinutes: 5,
    };

    const res = await schedulePublish(input);
    expect(res.jobIds).toHaveLength(2);
    expect(res.quotaBlocked).toHaveLength(0);

    const calls = mocks.mockDb.insert.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].channel_id).toBe('ch1');
    expect(calls[0][0].scheduled_at).toBe(scheduledAt);
    expect(calls[1][0].channel_id).toBe('ch2');
    expect(calls[1][0].scheduled_at).toBe(scheduledAt + 300);
  });

  it('handles database conflicts by shifting forward in 5-minute steps', async () => {
    mocks.mockDb.in.mockResolvedValueOnce({
      data: [{ id: 'ch1', tenant_id: 't1', provider: 'youtube', status: 'active' }],
    });

    mocks.mockDb.lte
      .mockResolvedValueOnce({ data: [{ id: 'conflict-job-id' }] })
      .mockResolvedValueOnce({ data: [] });

    const scheduledAt = Date.UTC(2026, 4, 25, 10, 0, 0) / 1000;

    const input = {
      videoJobId: 'v1',
      tenantId: 't1',
      userId: 'u1',
      channelIds: ['ch1'],
      caption: 'Test caption',
      hashtags: ['test'],
      scheduledAt,
    };

    const res = await schedulePublish(input);
    expect(res.jobIds).toHaveLength(1);

    const calls = mocks.mockDb.insert.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].scheduled_at).toBe(scheduledAt + 300);
  });
});
