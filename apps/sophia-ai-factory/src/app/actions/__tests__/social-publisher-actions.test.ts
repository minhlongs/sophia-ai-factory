/**
 * Social Publisher Server Actions Test Suite
 * Validates dispatch, kill-switch, draft approval, and D1 persistence.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchSocialPublishAction,
  toggleChannelKillSwitchAction,
  approveDraftAction,
  listUserDraftsAction,
} from '../social-publisher-actions';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_123'] }),
  },
}));

vi.mock('@/land/social/publish-job-store', () => ({
  createPublishJob: vi.fn(),
  listUserDraftJobs: vi.fn(),
  transitionDraftToPending: vi.fn(),
}));

vi.mock('@/land/social/platform-credentials-store', () => ({
  listUserCredentials: vi.fn(),
  setChannelKillSwitch: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import {
  createPublishJob,
  listUserDraftJobs,
  transitionDraftToPending,
} from '@/land/social/publish-job-store';
import {
  listUserCredentials,
  setChannelKillSwitch,
} from '@/land/social/platform-credentials-store';

describe('social-publisher-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dispatchSocialPublishAction', () => {
    it('returns error when user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const res = await dispatchSocialPublishAction({
        title: 'Test Video',
        caption: 'Caption',
        videoUrl: 'https://example.com/video.mp4',
        platforms: ['YOUTUBE_SHORTS'],
        useJitter: true,
      });

      expect(res.ok).toBe(false);
      expect(res.message).toContain('Unauthorized');
    });

    it('rejects empty title', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: 'test@example.com' } as never);

      const res = await dispatchSocialPublishAction({
        title: '   ',
        caption: 'Caption',
        videoUrl: 'https://example.com/video.mp4',
        platforms: ['YOUTUBE_SHORTS'],
        useJitter: true,
      });

      expect(res.ok).toBe(false);
      expect(res.message).toContain('Title is required');
    });

    it('rejects empty platforms', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: 'test@example.com' } as never);

      const res = await dispatchSocialPublishAction({
        title: 'Title',
        caption: 'Caption',
        videoUrl: 'https://example.com/video.mp4',
        platforms: [],
        useJitter: true,
      });

      expect(res.ok).toBe(false);
      expect(res.message).toContain('Select at least 1 platform');
    });

    it('blocks dispatch when channel is not connected', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: 'test@example.com' } as never);
      vi.mocked(listUserCredentials).mockResolvedValue([]);

      const res = await dispatchSocialPublishAction({
        title: 'Title',
        caption: 'Caption',
        videoUrl: 'https://example.com/video.mp4',
        platforms: ['YOUTUBE_SHORTS'],
        useJitter: false,
      });

      expect(res.ok).toBe(false);
      expect(res.message).toContain('Channel not connected');
    });

    it('blocks dispatch when kill switch is active', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: 'test@example.com' } as never);
      vi.mocked(listUserCredentials).mockResolvedValue([
        {
          id: 'cred_1',
          userId: 'user_1',
          platform: 'YOUTUBE_SHORTS',
          channelId: 'yt_123',
          channelName: 'Channel',
          encryptedTokens: 'enc',
          tokenExpiresAt: Date.now() + 100000,
          dailyPostCount: 2,
          lastPublishedAt: Date.now() - 50000,
          killSwitchActive: true,
          lockVersion: 1,
          updatedAt: Date.now(),
        },
      ]);

      const res = await dispatchSocialPublishAction({
        title: 'Title',
        caption: 'Caption',
        videoUrl: 'https://example.com/video.mp4',
        platforms: ['YOUTUBE_SHORTS'],
        useJitter: false,
      });

      expect(res.ok).toBe(false);
      expect(res.message).toContain('Kill switch is active');
    });

    it('successfully dispatches job and sends Inngest event', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: 'test@example.com' } as never);
      vi.mocked(listUserCredentials).mockResolvedValue([
        {
          id: 'cred_1',
          userId: 'user_1',
          platform: 'YOUTUBE_SHORTS',
          channelId: 'yt_123',
          channelName: 'Channel',
          encryptedTokens: 'enc',
          tokenExpiresAt: Date.now() + 100000,
          dailyPostCount: 2,
          lastPublishedAt: Date.now() - 50000,
          killSwitchActive: false,
          lockVersion: 1,
          updatedAt: Date.now(),
        },
      ]);

      vi.mocked(createPublishJob).mockResolvedValue({
        id: 'pub_999',
        userId: 'user_1',
        channelId: 'yt_123',
        platform: 'YOUTUBE_SHORTS',
        videoUrl: 'https://example.com/video.mp4',
        title: 'Title',
        description: 'Caption',
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const res = await dispatchSocialPublishAction({
        title: 'Title',
        caption: 'Caption',
        videoUrl: 'https://example.com/video.mp4',
        platforms: ['YOUTUBE_SHORTS'],
        useJitter: false,
      });

      expect(res.ok).toBe(true);
      expect(res.jobIds).toEqual(['pub_999']);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'social.publish.dispatched',
          data: expect.objectContaining({
            jobId: 'pub_999',
            platform: 'YOUTUBE_SHORTS',
          }),
        }),
      );
    });
  });

  describe('toggleChannelKillSwitchAction', () => {
    it('updates kill switch for user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1' } as never);
      vi.mocked(setChannelKillSwitch).mockResolvedValue(true);

      const ok = await toggleChannelKillSwitchAction('yt_123', false);
      expect(ok).toBe(true);
      expect(setChannelKillSwitch).toHaveBeenCalledWith('user_1', 'yt_123', true);
    });
  });

  describe('approveDraftAction', () => {
    it('transitions draft and triggers Inngest publish', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1' } as never);
      vi.mocked(transitionDraftToPending).mockResolvedValue({
        id: 'job_draft',
        userId: 'user_1',
        channelId: 'ch_1',
        platform: 'TIKTOK_V2',
        videoUrl: 'https://example.com/vid.mp4',
        title: 'Tiktok Draft',
        description: 'Desc',
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const ok = await approveDraftAction('job_draft');
      expect(ok).toBe(true);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'social.publish.dispatched',
          data: expect.objectContaining({ jobId: 'job_draft' }),
        }),
      );
    });
  });

  describe('listUserDraftsAction', () => {
    it('returns empty array when unauthenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      const res = await listUserDraftsAction();
      expect(res).toEqual([]);
    });

    it('returns drafts when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1' } as never);
      vi.mocked(listUserDraftJobs).mockResolvedValue([
        { id: 'd1', status: 'DRAFT' } as never,
      ]);

      const res = await listUserDraftsAction();
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('d1');
    });
  });
});
