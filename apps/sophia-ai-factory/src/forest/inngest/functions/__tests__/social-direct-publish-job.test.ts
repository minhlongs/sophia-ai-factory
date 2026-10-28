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

/**
 * YouTube's resumable-upload handshake answers with the session URL in a
 * Location header; the executor reads that header, then PUTs the media.
 */
function responseWithLocation(location: string): Response {
  return {
    ok: true,
    status: 200,
    headers: new Map([['location', location]]),
    json: async () => ({}),
  } as unknown as Response;
}

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

  /**
   * Labelled provider fixture. Returns shape-copies of each platform's
   * documented success response so the executor has to read a REAL id out of
   * a REAL (simulated) body. The ids below are fixture values only — they are
   * never derived from a job id, which is exactly what the old fabricated
   * adapter did.
   */
  const fixtureFetch = vi.fn();
  const fixtureToken = 'fixture_access_token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    fixtureFetch.mockReset();
    vi.mocked(circuitBreaker.shouldAllowRequest).mockReturnValue(true);
    vi.mocked(credStore.getCredential).mockResolvedValue(sampleCred);
    vi.mocked(vault.decryptTokenVault).mockResolvedValue({
      accessToken: fixtureToken,
      expiresAt: Date.now() + 3600000,
    });
    vi.mocked(jobStore.getPublishJob).mockResolvedValue({ status: 'PENDING' } as never);
  });

  it('orchestrates direct publish with the decrypted token threaded into the upload', async () => {
    fixtureFetch
      .mockResolvedValueOnce(responseWithLocation('https://fixtures.googleapis.test/session_yt'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'provider_yt_video_1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { publish_id: 'provider_tt_publish_1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: 'SUCCESS_PUBLISH' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'provider_ig_media_1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'provider_ig_media_1' }) });

    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);

    const ytEvent = {
      data: {
        jobId: 'job_yt_1',
        userId: 'user_1',
        accessToken: 'ignored_event_field',
        channelId: 'chan_yt_1',
        platform: 'YOUTUBE_SHORTS' as const,
        videoUrl: 'https://cdn.example.com/v.mp4',
        title: 'Epic Short',
        description: '#Shorts',
      },
    };
    const ytRes = await processSocialDirectPublishJob({ event: ytEvent, step: mockStep });
    expect(ytRes.status).toBe('PUBLISHED');
    expect((ytRes as { platformPostId: string }).platformPostId).toBe('provider_yt_video_1');
    expect((ytRes as { publishedUrl: string }).publishedUrl).toBe(
      'https://www.youtube.com/shorts/provider_yt_video_1',
    );
    expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('YOUTUBE_SHORTS', 'chan_yt_1');
    expect(jobStore.updatePublishJobStatus).toHaveBeenCalledWith('job_yt_1', 'UPLOADING');

    const ttRes = await processSocialDirectPublishJob({
      event: { data: { ...ytEvent.data, jobId: 'job_tt_1', platform: 'TIKTOK_V2' as const } },
      step: mockStep,
    });
    expect((ttRes as { platformPostId: string }).platformPostId).toBe('provider_tt_publish_1');

    const igRes = await processSocialDirectPublishJob({
      event: { data: { ...ytEvent.data, jobId: 'job_ig_1', platform: 'INSTAGRAM_REELS' as const } },
      step: mockStep,
    });
    expect((igRes as { platformPostId: string }).platformPostId).toBe('provider_ig_media_1');
  });

  it('marks the job FAILED and records a failure — never a success — when the provider yields no id', async () => {
    fixtureFetch
      .mockResolvedValueOnce(responseWithLocation('https://fixtures.googleapis.test/session_yt'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'quotaExceeded' }) });

    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);

    await expect(processSocialDirectPublishJob({
      event: {
        data: {
          jobId: 'job_no_id',
          userId: 'user_1',
          channelId: 'chan_yt_1',
          platform: 'YOUTUBE_SHORTS' as const,
          videoUrl: 'https://cdn.example.com/v.mp4',
          title: 'No Id',
          description: 'No Id',
        },
      },
      step: mockStep,
    })).rejects.toThrow(/PROVIDER_RESULT_UNVERIFIABLE/);

    expect(jobStore.updatePublishJobStatus).toHaveBeenCalledWith(
      'job_no_id',
      'FAILED',
      expect.objectContaining({ error: expect.stringContaining('PROVIDER_RESULT_UNVERIFIABLE') }),
    );
    expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
    expect(circuitBreaker.recordFailure).toHaveBeenCalled();
  });

  it('publishes once — a re-delivered event for a terminal job does not upload again', async () => {
    fixtureFetch
      .mockResolvedValueOnce(responseWithLocation('https://fixtures.googleapis.test/session_dup'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'provider_yt_dup_1' }) });
    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);
    vi.mocked(jobStore.getPublishJob).mockResolvedValue({ status: 'PUBLISHED' } as never);

    const event = {
      data: {
        jobId: 'job_already_published',
        userId: 'user_1',
        channelId: 'chan_yt_1',
        platform: 'YOUTUBE_SHORTS' as const,
        videoUrl: 'https://cdn.example.com/v.mp4',
        title: 'Already Done',
        description: 'Already Done',
      },
    };

    const res = await processSocialDirectPublishJob({ event, step: mockStep });
    expect(res.status).toBe('SKIPPED_ALREADY_UPLOADED');
    expect(fixtureFetch).not.toHaveBeenCalled();
    expect(jobStore.updatePublishJobStatus).not.toHaveBeenCalled();
  });

  it('publishes once — a retry that died mid-upload does not post the channel twice', async () => {
    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);
    vi.mocked(jobStore.getPublishJob).mockResolvedValue({ status: 'UPLOADING' } as never);

    const res = await processSocialDirectPublishJob({
      event: {
        data: {
          jobId: 'job_died_mid_upload',
          userId: 'user_1',
          channelId: 'chan_yt_1',
          platform: 'YOUTUBE_SHORTS' as const,
          videoUrl: 'https://cdn.example.com/v.mp4',
          title: 'Mid Upload',
          description: 'Mid Upload',
        },
      },
      step: mockStep,
    });

    expect(res.status).toBe('SKIPPED_ALREADY_UPLOADED');
    expect(fixtureFetch).not.toHaveBeenCalled();
  });

  it('still publishes when the prior attempt only reached the pacing stage', async () => {
    fixtureFetch
      .mockResolvedValueOnce(responseWithLocation('https://fixtures.googleapis.test/session_paced'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'provider_yt_from_paced' }) });
    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);
    vi.mocked(jobStore.getPublishJob).mockResolvedValue({ status: 'PENDING' } as never);

    const res = await processSocialDirectPublishJob({
      event: {
        data: {
          jobId: 'job_pending_retry',
          userId: 'user_1',
          channelId: 'chan_yt_1',
          platform: 'YOUTUBE_SHORTS' as const,
          videoUrl: 'https://cdn.example.com/v.mp4',
          title: 'Pending Retry',
          description: 'Pending Retry',
        },
      },
      step: mockStep,
    });

    expect(res.status).toBe('PUBLISHED');
    expect((res as { platformPostId: string }).platformPostId).toBe('provider_yt_from_paced');
  });

  it('does not fabricate a post id or url when the upload transport fails outright', async () => {
    fixtureFetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });

    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);

    const result = await processSocialDirectPublishJob({
      event: {
        data: {
          jobId: 'job_http_401',
          userId: 'user_1',
          channelId: 'chan_yt_1',
          platform: 'YOUTUBE_SHORTS' as const,
          videoUrl: 'https://cdn.example.com/v.mp4',
          title: 'HTTP Fail',
          description: 'HTTP Fail',
        },
      },
      step: mockStep,
    }).catch((err: unknown) => ({ threw: err instanceof Error ? err.message : String(err) }));

    const text = JSON.stringify(result);
    expect(text).not.toContain('youtube.com/shorts/job_');
    expect(text).not.toContain('yt_job_');
    expect(jobStore.updatePublishJobStatus).toHaveBeenCalledWith(
      'job_http_401',
      'FAILED',
      expect.objectContaining({ error: 'HTTP_401' }),
    );
    expect(circuitBreaker.recordSuccess).not.toHaveBeenCalled();
  });

  it('handles pacing cap, cooldown sleep, and safety guards', async () => {
    vi.mocked(credStore.getCredential).mockResolvedValue({ ...sampleCred, dailyPostCount: 6 });
    const capped = await processSocialDirectPublishJob({
      event: { data: { jobId: 'j_cap', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    });
    expect(capped.status).toBe('HALTED_DAILY_CAP');

    vi.mocked(credStore.getCredential).mockResolvedValue({ ...sampleCred, lastPublishedAt: Date.now() - 1000 });
    fixtureFetch
      .mockResolvedValueOnce(responseWithLocation('https://fixtures.googleapis.test/session_pace'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'provider_yt_pace_1' }) });
    vi.stubGlobal('fetch', fixtureFetch as unknown as typeof fetch);
    const paced = await processSocialDirectPublishJob({
      event: { data: { jobId: 'j_pace', userId: 'u', channelId: 'c', platform: 'YOUTUBE_SHORTS' as const } },
      step: mockStep,
    });
    expect(mockStep.sleep).toHaveBeenCalled();
    expect(paced.status).toBe('PUBLISHED');

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
