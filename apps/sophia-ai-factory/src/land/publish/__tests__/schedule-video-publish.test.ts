/**
 * Unit tests for schedulePublish — RBAC enforcement, schedule guard,
 * channel ownership via user_id or tenant_id, and successful insertion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFirst, mockRun, mockBind, mockPrepare, mockGetD1Raw } = vi.hoisted(() => {
  const first = vi.fn();
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ first, run }));
  const prepare = vi.fn(() => ({ bind }));
  const getD1Raw = vi.fn().mockResolvedValue({ prepare });
  return {
    mockFirst: first,
    mockRun: run,
    mockBind: bind,
    mockPrepare: prepare,
    mockGetD1Raw: getD1Raw,
  };
});

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mockGetD1Raw,
}));

import {
  schedulePublish,
  PublishConfigurationError,
} from '@/land/publish/schedule-video-publish';

const NOW = Math.floor(Date.now() / 1000);

describe('schedulePublish', () => {
  beforeEach(() => {
    // resetAllMocks clears queued mockResolvedValueOnce values — clearAllMocks
    // leaves them queued and causes spillover between tests.
    vi.resetAllMocks();
    mockGetD1Raw.mockResolvedValue({ prepare: mockPrepare });
    mockBind.mockImplementation(() => ({ first: mockFirst, run: mockRun }));
    mockPrepare.mockImplementation(() => ({ bind: mockBind }));
    mockRun.mockResolvedValue({ success: true });
  });

  it('rejects missing videoId/channelId', async () => {
    await expect(
      schedulePublish({ userId: 'u1', videoId: '', channelId: 'c1', scheduledAt: NOW + 60 }),
    ).rejects.toBeInstanceOf(PublishConfigurationError);
  });

  it('rejects past schedule', async () => {
    await expect(
      schedulePublish({ userId: 'u1', videoId: 'v1', channelId: 'c1', scheduledAt: NOW - 3600 }),
    ).rejects.toThrow(/before now/);
  });

  it('rejects when video not found', async () => {
    mockFirst.mockResolvedValueOnce(null); // video lookup
    await expect(
      schedulePublish({ userId: 'u1', videoId: 'v1', channelId: 'c1', scheduledAt: NOW + 60 }),
    ).rejects.toThrow(/video v1 not found/);
  });

  it('rejects when video belongs to other user', async () => {
    mockFirst
      .mockResolvedValueOnce({ id: 'v1', user_id: 'OTHER' })
      .mockResolvedValueOnce({ id: 'c1', user_id: 'u1', tenant_id: null, provider: 'youtube' });
    await expect(
      schedulePublish({ userId: 'u1', videoId: 'v1', channelId: 'c1', scheduledAt: NOW + 60 }),
    ).rejects.toThrow(/different user/);
  });

  it('rejects when channel not found', async () => {
    mockFirst
      .mockResolvedValueOnce({ id: 'v1', user_id: 'u1' })
      .mockResolvedValueOnce(null);
    await expect(
      schedulePublish({ userId: 'u1', videoId: 'v1', channelId: 'c1', scheduledAt: NOW + 60 }),
    ).rejects.toThrow(/channel c1 not found/);
  });

  it('accepts channel via tenant_id ownership', async () => {
    mockFirst
      .mockResolvedValueOnce({ id: 'v1', user_id: 'u1' })
      .mockResolvedValueOnce({ id: 'c1', user_id: null, tenant_id: 'u1', provider: 'youtube' });
    const result = await schedulePublish({
      userId: 'u1',
      videoId: 'v1',
      channelId: 'c1',
      scheduledAt: NOW + 600,
    });
    expect(result.status).toBe('scheduled');
    expect(result.jobId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('happy path inserts row with serialized hashtags', async () => {
    mockFirst
      .mockResolvedValueOnce({ id: 'v1', user_id: 'u1' })
      .mockResolvedValueOnce({ id: 'c1', user_id: 'u1', tenant_id: null, provider: 'youtube' });
    const result = await schedulePublish({
      userId: 'u1',
      videoId: 'v1',
      channelId: 'c1',
      scheduledAt: NOW + 3600,
      caption: 'Watch now',
      hashtags: ['ai', 'shorts'],
      productLink: 'https://shop.example.com',
    });
    expect(result.status).toBe('scheduled');
    expect(mockRun).toHaveBeenCalled();
    // Verify the hashtags column got serialized JSON
    const lastBindCall = mockBind.mock.calls[mockBind.mock.calls.length - 1] as unknown[];
    expect(lastBindCall[5]).toBe('["ai","shorts"]');
  });
});
