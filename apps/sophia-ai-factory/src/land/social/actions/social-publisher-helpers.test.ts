import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  encryptTokenVault: vi.fn(),
  getCredential: vi.fn(),
  upsertCredential: vi.fn(),
  createPublishJob: vi.fn(),
  toSocialPublishResult: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({ inngest: { send: mocks.send } }));
vi.mock('@/seed/security/oauth-token-vault', () => ({ encryptTokenVault: mocks.encryptTokenVault }));
vi.mock('@/land/social/platform-credentials-store', () => ({
  getCredential: mocks.getCredential,
  upsertCredential: mocks.upsertCredential,
}));
vi.mock('@/land/social/publish-job-store', () => ({
  createPublishJob: mocks.createPublishJob,
  toSocialPublishResult: mocks.toSocialPublishResult,
}));

import type { DispatchSocialPublishInput, UpdateChannelCredentialsInput } from './social-publisher-schemas';
import { executeDispatchSocialPublish, executeUpdateChannelCredentials } from './social-publisher-helpers';

const dispatchInput = {
  channelId: 'channel-1',
  platform: 'YOUTUBE_SHORTS',
  videoUrl: 'https://cdn.example.test/video.mp4',
  title: 'A short video',
  tags: ['demo', 'ai'],
  scheduledFor: 123_456,
} satisfies DispatchSocialPublishInput;

const credentialsInput = {
  platform: 'TIKTOK_V2',
  channelId: 'channel-2',
  channelName: 'Demo channel',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenExpiresAt: 123_456,
} satisfies UpdateChannelCredentialsInput;

describe('social direct publishing execution helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ ids: ['event-1'] });
    mocks.getCredential.mockResolvedValue({ killSwitchActive: false });
    mocks.createPublishJob.mockResolvedValue({ id: 'job-1' });
    mocks.toSocialPublishResult.mockReturnValue({
      jobId: 'job-1', platform: 'YOUTUBE_SHORTS', status: 'PENDING',
    });
    mocks.encryptTokenVault.mockResolvedValue('encrypted-token-bundle');
    mocks.upsertCredential.mockResolvedValue({ channelId: 'channel-2', platform: 'TIKTOK_V2' });
  });

  describe('executeDispatchSocialPublish', () => {
    it('validates input before reading credentials', async () => {
      const result = await executeDispatchSocialPublish('user-1', {
        ...dispatchInput, videoUrl: 'not a URL',
      });

      expect(result).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
      expect(mocks.getCredential).not.toHaveBeenCalled();
      expect(mocks.createPublishJob).not.toHaveBeenCalled();
    });

    it('fails when channel credentials are missing', async () => {
      mocks.getCredential.mockResolvedValueOnce(null);

      await expect(executeDispatchSocialPublish('user-1', dispatchInput)).resolves.toEqual({
        success: false, error: 'Channel credentials not configured', code: 'NOT_FOUND',
      });
      expect(mocks.createPublishJob).not.toHaveBeenCalled();
    });

    it('blocks publishing when the channel emergency kill switch is active', async () => {
      mocks.getCredential.mockResolvedValueOnce({ killSwitchActive: true });

      await expect(executeDispatchSocialPublish('user-1', dispatchInput)).resolves.toEqual({
        success: false, error: 'Channel emergency kill switch active', code: 'KILL_SWITCH_ACTIVE',
      });
      expect(mocks.createPublishJob).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
    });

    it('creates a pending job and dispatches the event with normalized optional fields', async () => {
      const result = await executeDispatchSocialPublish('user-1', dispatchInput);

      expect(result).toEqual({
        success: true, data: { jobId: 'job-1', platform: 'YOUTUBE_SHORTS', status: 'PENDING' },
      });
      expect(mocks.getCredential).toHaveBeenCalledWith('user-1', 'YOUTUBE_SHORTS', 'channel-1');
      expect(mocks.createPublishJob).toHaveBeenCalledWith({
        userId: 'user-1', channelId: 'channel-1', platform: 'YOUTUBE_SHORTS',
        videoUrl: 'https://cdn.example.test/video.mp4', title: 'A short video',
        description: '', tags: ['demo', 'ai'], scheduledFor: 123_456,
      });
      expect(mocks.send).toHaveBeenCalledWith({
        name: 'social.publish.dispatched',
        data: {
          jobId: 'job-1', userId: 'user-1', channelId: 'channel-1', platform: 'YOUTUBE_SHORTS',
          videoUrl: 'https://cdn.example.test/video.mp4', title: 'A short video',
          description: '', tags: ['demo', 'ai'],
        },
      });
    });

    it('does not hide a queue dispatch failure', async () => {
      mocks.send.mockRejectedValueOnce(new Error('queue unavailable'));

      await expect(executeDispatchSocialPublish('user-1', dispatchInput)).rejects.toThrow('queue unavailable');
    });
  });

  describe('executeUpdateChannelCredentials', () => {
    it('rejects invalid credentials before encrypting or writing them', async () => {
      const result = await executeUpdateChannelCredentials('user-1', {
        ...credentialsInput, accessToken: '',
      });

      expect(result).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
      expect(mocks.encryptTokenVault).not.toHaveBeenCalled();
      expect(mocks.upsertCredential).not.toHaveBeenCalled();
    });

    it('encrypts tokens for their owner and persists the credential record', async () => {
      const result = await executeUpdateChannelCredentials('user-1', credentialsInput);

      expect(mocks.encryptTokenVault).toHaveBeenCalledWith({
        accessToken: 'access-token', refreshToken: 'refresh-token', expiresAt: 123_456,
      }, { userId: 'user-1', platform: 'TIKTOK_V2', channelId: 'channel-2' });
      expect(mocks.upsertCredential).toHaveBeenCalledWith({
        userId: 'user-1', platform: 'TIKTOK_V2', channelId: 'channel-2',
        channelName: 'Demo channel', encryptedTokens: 'encrypted-token-bundle', tokenExpiresAt: 123_456,
      });
      expect(result).toEqual({
        success: true, data: { channelId: 'channel-2', platform: 'TIKTOK_V2' },
      });
    });

    it('propagates encryption failures without writing plaintext credentials', async () => {
      mocks.encryptTokenVault.mockRejectedValueOnce(new Error('vault unavailable'));

      await expect(executeUpdateChannelCredentials('user-1', credentialsInput))
        .rejects.toThrow('vault unavailable');
      expect(mocks.upsertCredential).not.toHaveBeenCalled();
    });
  });
});
