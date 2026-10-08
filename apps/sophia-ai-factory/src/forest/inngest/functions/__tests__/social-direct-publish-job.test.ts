import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processSocialDirectPublishJob } from '../social-direct-publish-job';
import type { PlatformCredentialRecord } from '@/seed/types/social-publisher-types';
import * as vault from '@/seed/security/oauth-token-vault';
import * as credStore from '@/land/social/platform-credentials-store';
import * as jobStore from '@/land/social/publish-job-store';
import * as circuitBreaker from '@/seed/security/circuit-breaker';
import * as authSession from '@/seed/auth/better-auth-session';
import {
  dispatchSocialPublishAction,
  listConnectedChannelsAction,
  toggleChannelKillSwitchAction,
  updateChannelCredentialsAction,
} from '@/land/social/actions/social-publisher-actions';

vi.mock('@/seed/security/oauth-token-vault');
vi.mock('@/land/social/platform-credentials-store');
vi.mock('@/land/social/publish-job-store');
vi.mock('@/seed/security/circuit-breaker');
vi.mock('@/seed/auth/better-auth-session');
vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ['evt_1'] }), createFunction: vi.fn() },
}));

describe('socialDirectPublishJob & Server Actions', () => {
  const mockStep = {
    run: vi.fn().mockImplementation(async (_n: string, fn: () => Promise<unknown>) => fn()),
    sleep: vi.fn().mockResolvedValue(undefined),
  };

  const sampleCred: PlatformCredentialRecord = {
    id: 'cred_1',
    userId: 'user_1',
    platform: 'YOUTUBE_SHORTS',
    channelId: 'chan_yt_1',
    channelName: 'Tech Channel',
    encryptedTokens: 'iv:tag:cipher',
    tokenExpiresAt: Date.now() + 3600000,
    dailyPostCount: 0,
    killSwitchActive: false,
    lockVersion: 1,
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(true);
    vi.mocked(credStore.getCredential).mockResolvedValue(sampleCred);
    vi.mocked(vault.decryptTokenVault).mockResolvedValue({ accessToken: 'valid_token', expiresAt: Date.now() + 3600000 });
  });

  it('orchestrates direct publish across platforms', async () => {
    const ytEvent = {
      data: {
        jobId: 'job_yt_1',
        userId: 'user_1',
        channelId: 'chan_yt_1',
        platform: 'YOUTUBE_SHORTS' as const,
        videoUrl: 'https://cdn.example.com/v.mp4',
        title: 'Epic Short',
        description: '#Shorts',
      },
    };
    const ytRes = await processSocialDirectPublishJob({ event: ytEvent, step: mockStep });
    expect(ytRes.status).toBe('PUBLISHED');
    expect((ytRes as { platformPostId: string }).platformPostId).toBe('yt_job_yt_1');
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('YOUTUBE_SHORTS', 'chan_yt_1');
    expect(jobStore.updatePublishJobStatus).toHaveBeenCalledWith('job_yt_1', 'UPLOADING');

    const ttRes = await processSocialDirectPublishJob({
      event: { data: { ...ytEvent.data, jobId: 'job_tt_1', platform: 'TIKTOK_V2' as const } },
      step: mockStep,
    });
    expect((ttRes as { platformPostId: string }).platformPostId).toBe('tt_job_tt_1');

    const igRes = await processSocialDirectPublishJob({
      event: { data: { ...ytEvent.data, jobId: 'job_ig_1', platform: 'INSTAGRAM_REELS' as const } },
      step: mockStep,
    });
    expect((igRes as { platformPostId: string }).platformPostId).toBe('ig_job_ig_1');
  });

  it('handles pacing cap, cooldown sleep, and safety guards', async () => {
    vi.mocked(credStore.getCredential).mockResolvedValue({ ...sampleCred, dailyPostCount: 6 });
    const capped = await processSocialDirectPublishJob({
      event: { data: { jobId: 'j_cap', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    });
    expect(capped.status).toBe('HALTED_DAILY_CAP');

    vi.mocked(credStore.getCredential).mockResolvedValue({ ...sampleCred, lastPublishedAt: Date.now() - 1000 });
    await processSocialDirectPublishJob({
      event: { data: { jobId: 'j_pace', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    });
    expect(mockStep.sleep).toHaveBeenCalled();

    vi.mocked(credStore.getCredential).mockResolvedValue({ ...sampleCred, killSwitchActive: true });
    const killed = await processSocialDirectPublishJob({
      event: { data: { jobId: 'j_kill', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    });
    expect(killed.status).toBe('ABORTED_SAFETY');

    vi.mocked(credStore.getCredential).mockResolvedValue(sampleCred);
    vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(false);
    const cbOpen = await processSocialDirectPublishJob({
      event: { data: { jobId: 'j_cb', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    });
    expect(cbOpen.status).toBe('ABORTED_SAFETY');
  });

  it('handles platform failure & server actions', async () => {
    vi.mocked(vault.decryptTokenVault).mockRejectedValue(new Error('Corrupted vault'));
    await expect(processSocialDirectPublishJob({
      event: { data: { jobId: 'j_err', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    })).rejects.toThrow('Corrupted vault');

    vi.mocked(authSession.getCurrentUser).mockResolvedValue({ id: 'user_1', email: 'test@example.com', role: 'user' });
    vi.mocked(credStore.listUserCredentials).mockResolvedValue([sampleCred]);
    vi.mocked(credStore.setChannelKillSwitch).mockResolvedValue(true);
    vi.mocked(credStore.upsertCredential).mockResolvedValue(sampleCred);
    vi.mocked(vault.encryptTokenVault).mockResolvedValue('encrypted:tokens');
    vi.mocked(jobStore.createPublishJob).mockResolvedValue({
      id: 'pub_1', userId: 'user_1', channelId: 'c', platform: 'YOUTUBE_SHORTS',
      videoUrl: 'https://cdn.example.com/v.mp4', title: 'T', description: '',
      status: 'PENDING', createdAt: Date.now(), updatedAt: Date.now(),
    });
    vi.mocked(jobStore.toSocialPublishResult).mockReturnValue({ jobId: 'pub_1', platform: 'YOUTUBE_SHORTS', status: 'PENDING' });

    const dispatch = await dispatchSocialPublishAction({
      channelId: 'c', platform: 'YOUTUBE_SHORTS', videoUrl: 'https://cdn.example.com/v.mp4', title: 'Post',
    });
    expect(dispatch.success).toBe(true);

    const list = await listConnectedChannelsAction();
    expect(list.success).toBe(true);

    const toggle = await toggleChannelKillSwitchAction('c', true);
    expect(toggle.success).toBe(true);

    const update = await updateChannelCredentialsAction({
      platform: 'YOUTUBE_SHORTS', channelId: 'c', channelName: 'Chan', accessToken: 'token_1', tokenExpiresAt: Date.now() + 3600000,
    });
    expect(update.success).toBe(true);
  });
});
