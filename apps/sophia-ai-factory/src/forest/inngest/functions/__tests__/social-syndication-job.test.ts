import { describe, it, expect, vi, beforeEach } from 'vitest';
import { socialSyndicationJob } from '../social-syndication-job';
import * as killSwitchStore from '@/tree/affiliate/kill-switch/kill-switch-store';

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  isAffiliateKillSwitchActive: vi.fn(),
}));

describe('socialSyndicationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('halts immediately if Affiliate Kill Switch is active', async () => {
    vi.mocked(killSwitchStore.isAffiliateKillSwitchActive).mockResolvedValue(true);

    const mockStep = {
      run: vi.fn().mockImplementation(async (name, fn) => fn()),
      sleep: vi.fn(),
    };

    const event = {
      data: {
        jobId: 'job_123',
        tenantId: 'tenant_abc',
        videoUrl: 'https://cdn.example.com/video.mp4',
        caption: 'Top AI Tool #shorts',
        channel: {
          channelId: 'chan_tiktok_1',
          platform: 'tiktok',
          todayPublishedCount: 0,
          lastPublishedAtMs: null,
        },
      },
    };

    // Cast handler to test execution
    const handler = (socialSyndicationJob as unknown as { fn: Function }).fn;
    const result = await handler({ event, step: mockStep });

    expect(result).toEqual({
      status: 'HALTED_BY_KILL_SWITCH',
      jobId: 'job_123',
    });
    expect(mockStep.sleep).not.toHaveBeenCalled();
  });

  it('pauses if daily quota is exceeded', async () => {
    vi.mocked(killSwitchStore.isAffiliateKillSwitchActive).mockResolvedValue(false);

    const mockStep = {
      run: vi.fn().mockImplementation(async (name, fn) => fn()),
      sleep: vi.fn(),
    };

    const event = {
      data: {
        jobId: 'job_456',
        tenantId: 'tenant_abc',
        videoUrl: 'https://cdn.example.com/video.mp4',
        caption: 'Top Crypto DEX #shorts',
        channel: {
          channelId: 'chan_yt_1',
          platform: 'youtube',
          todayPublishedCount: 4, // Max daily cap
          lastPublishedAtMs: Date.now() - 5 * 3600 * 1000,
        },
      },
    };

    const handler = (socialSyndicationJob as unknown as { fn: Function }).fn;
    const result = await handler({ event, step: mockStep });

    expect(result.status).toBe('PAUSED_BY_PACER');
    expect(result.reason).toBe('MAX_DAILY_QUOTA_REACHED');
    expect(mockStep.sleep).not.toHaveBeenCalled();
  });

  it('sleeps for organic delay and publishes when eligible', async () => {
    vi.mocked(killSwitchStore.isAffiliateKillSwitchActive).mockResolvedValue(false);

    const mockStep = {
      run: vi.fn().mockImplementation(async (name, fn) => fn()),
      sleep: vi.fn().mockResolvedValue(undefined),
    };

    const event = {
      data: {
        jobId: 'job_789',
        tenantId: 'tenant_abc',
        videoUrl: 'https://cdn.example.com/video.mp4',
        caption: 'Viral SaaS Bot #shorts',
        channel: {
          channelId: 'chan_x_1',
          platform: 'x',
          todayPublishedCount: 0,
          lastPublishedAtMs: null,
        },
      },
    };

    const handler = (socialSyndicationJob as unknown as { fn: Function }).fn;
    const result = await handler({ event, step: mockStep });

    expect(mockStep.sleep).toHaveBeenCalled();
    expect(result.status).toBe('PUBLISHED_SUCCESSFULLY');
    expect(result.result.published).toBe(true);
    expect(result.result.channelId).toBe('chan_x_1');
  });
});
