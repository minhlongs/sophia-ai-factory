import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  prepare: vi.fn(),
};

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(() => ({ unwrap: () => mockDb })),
}));

vi.mock('@/forest/publishing/schedule-publish', () => ({
  schedulePublish: vi.fn(async () => ({ jobId: 'job-1' })),
}));

import { schedulePublish } from '@/forest/publishing/schedule-publish';
import { handle } from './social-publish';

const mockSchedulePublish = schedulePublish as ReturnType<typeof vi.fn>;

function mockConnectedChannels(rows: Array<{ id: string; provider: string }>, telegramChatId?: string) {
  mockDb.prepare
    .mockReturnValueOnce({
      bind: vi.fn(() => ({
        all: vi.fn(async () => ({ results: rows })),
      })),
    })
    .mockReturnValueOnce({
      bind: vi.fn(() => ({
        first: vi.fn(async () => telegramChatId ? { chat_id: telegramChatId } : null),
      })),
    });
}

describe('social:publish handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips safely when all_connected has no active channels', async () => {
    mockConnectedChannels([]);

    const result = await handle({
      missionId: 'm-1',
      userId: 'u-1',
      command: 'social:publish',
      params: { platform: 'all_connected', videoId: 'video-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.data?.skipped).toBe(true);
    expect(result.data?.publishedChannels).toEqual([]);
    expect(mockSchedulePublish).not.toHaveBeenCalled();
  });

  it('schedules a job for each connected channel', async () => {
    mockConnectedChannels([{ id: 'pc-1', provider: 'youtube' }], 'tg-1');

    const result = await handle({
      missionId: 'm-1',
      userId: 'u-1',
      command: 'social:publish',
      params: {
        platform: 'all_connected',
        video_id: 'video-1',
        caption: 'Launch caption',
        hashtags: ['#one', '#two'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data?.publishedChannels).toEqual(['youtube', 'telegram']);
    expect(mockSchedulePublish).toHaveBeenCalledTimes(2);
    expect(mockSchedulePublish).toHaveBeenNthCalledWith(1, mockDb, expect.objectContaining({
      channelId: 'pc-1',
      provider: 'youtube',
      videoId: 'video-1',
      caption: 'Launch caption #one #two',
    }));
    expect(mockSchedulePublish).toHaveBeenNthCalledWith(2, mockDb, expect.objectContaining({
      channelId: 'tg-1',
      provider: 'telegram',
      videoId: 'video-1',
    }));
  });
});
