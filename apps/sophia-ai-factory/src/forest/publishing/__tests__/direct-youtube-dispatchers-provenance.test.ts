/**
 * Tests verifying deterministic provenance wiring across direct YouTube upload
 * dispatchers (`youtube:publish`, `publishVideo`, `dispatchPlatformUpload`,
 * `distributionFanout`, and `executePublishWorkflow` claim-first race safety).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  publisherUpload: vi.fn(),
  adapterUploadVideo: vi.fn(),
  forestYoutubeUpload: vi.fn(),
  executePublish: vi.fn(),
  findJobById: vi.fn(),
  checkAndMarkMaxRetries: vi.fn(),
  atomicClaimJob: vi.fn(),
  getKillState: vi.fn(),
  updateJob: vi.fn(),
  eqJob: vi.fn(),
  getPlan: vi.fn(),
  getPosts: vi.fn(),
  updatePostStatus: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/tree/crypto/token-crypto', () => ({
  decryptToken: vi.fn(async () => 'plain-access-token'),
}));
vi.mock('@/forest/publishing/oauth-token-refresher', () => ({
  refreshChannelToken: vi.fn(),
}));
vi.mock('@/land/video/publishing/providers/youtube-publisher', () => ({
  YouTubePublisher: class {
    upload = hoisted.publisherUpload;
    pollStatus = vi.fn();
    getMetrics = vi.fn();
  },
}));
vi.mock('@/tree/publishing/credential-manager', () => ({
  getDecryptedCredentials: vi.fn(async () => ({
    accessToken: 'plain-access-token',
    refreshToken: 'rt',
    expiresAt: Date.now() + 3600_000,
  })),
}));
vi.mock('@/tree/publishing/token-refresh-service', () => ({
  getAdapter: vi.fn(() => ({
    uploadVideo: hoisted.adapterUploadVideo,
    refreshToken: vi.fn(),
  })),
}));
vi.mock('@/seed/db/repositories/video-publishes-repo', () => ({
  createVideoPublish: vi.fn(async () => ({ id: 'vp-1' })),
  updateVideoPublishStatus: vi.fn(async () => undefined),
}));
vi.mock('@/land/video/publishing/service/video-publisher-helpers', () => ({
  handleFeedbackCycleCreation: vi.fn(async () => undefined),
  resolvePlatformAccessToken: vi.fn(async () => 'plain-access-token'),
}));
vi.mock('@/forest/publishing/youtube-adapter', () => ({
  youtubeAdapter: {
    uploadVideo: hoisted.forestYoutubeUpload,
    pollStatus: vi.fn(),
    refreshToken: vi.fn(),
  },
}));
vi.mock('@/land/publish/distribution-plan', () => ({
  getDistributionPlan: hoisted.getPlan,
  getDistributionPosts: hoisted.getPosts,
  updateDistributionPostStatus: hoisted.updatePostStatus,
}));
vi.mock('@/tree/publishing/distribution-registry', () => ({
  executePublish: hoisted.executePublish,
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
    createFunction: vi.fn((_cfg, _trigger, handler) => ({ _handler: handler })),
  },
}));
vi.mock('@/land/video/publishing/publish-claim', () => ({
  findJobById: hoisted.findJobById,
  checkAndMarkMaxRetries: hoisted.checkAndMarkMaxRetries,
  atomicClaimJob: hoisted.atomicClaimJob,
}));
vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: hoisted.getKillState,
}));

import { createServerClient } from '@/seed/db/client';
import { resolveSyntheticMediaDisclosure } from '@/tree/publishing/synthetic-media-disclosure';
import { handle as handleYoutubePublishMission } from '@/forest/youtube/missions/youtube-publish';
import { publishVideo } from '@/land/video/publishing/service/video-publisher';
import { dispatchPlatformUpload } from '@/forest/publishing/distributor/adapter-dispatcher';
import { distributionFanout } from '@/forest/inngest/functions/distribution-fanout';
import { executePublishWorkflow } from '@/land/video/publishing/execute';

describe('Direct YouTube publish dispatchers provenance wiring & claim-first safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.eqJob.mockResolvedValue({});
    hoisted.updateJob.mockReturnValue({ eq: hoisted.eqJob });
    hoisted.checkAndMarkMaxRetries.mockResolvedValue(false);
    hoisted.getKillState.mockResolvedValue({ active: false, known: true });
  });

  it('attaches blocked provenance in youtube:publish mission when description contains unverified claims', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 86_400;
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'pc-1',
        external_account_id: 'UC1',
        display_name: 'Ch',
        status: 'active',
        access_token: 'enc',
        expires_at: futureExp,
        refresh_token: 'enc_r',
        provider: 'youtube',
        tenant_id: 'u-1',
        user_id: 'u-1',
      },
      error: null,
    });
    const eqNode: Record<string, unknown> = { single };
    eqNode.eq = vi.fn(() => eqNode);
    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({ select: () => eqNode }),
    } as never);
    hoisted.publisherUpload.mockResolvedValueOnce('YT_1');

    await handleYoutubePublishMission({
      missionId: 'm-1',
      userId: 'u-1',
      command: 'youtube:publish',
      params: {
        video_url: 'https://r2.example/v.mp4',
        channel_id: 'pc-1',
        title: 'Earn $5,000 per month passive income',
        description: 'Boost conversion by 80% overnight.',
      },
    });

    const uploadMeta = hoisted.publisherUpload.mock.calls[0]![1];
    expect(resolveSyntheticMediaDisclosure({ provenance: uploadMeta.provenance }).blocked).toBe(true);
  });

  it('attaches blocked provenance in publishVideo service and dispatchPlatformUpload for YouTube', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      prepare: () => ({
        bind: () => ({ first: async () => ({ user_id: 'u-1' }) }),
      }),
    } as never);
    hoisted.adapterUploadVideo.mockResolvedValueOnce({
      platformVideoId: 'yt-v1',
      status: 'processing',
    });

    await publishVideo(
      {
        videoId: 'vid-1',
        videoUrl: 'https://r2.example/v.mp4',
        platform: 'youtube',
        title: 'Clinically proven method',
        description: 'Clinically proven to cure insomnia.',
      },
      'u-1',
    );
    const serviceParams = hoisted.adapterUploadVideo.mock.calls[0]![1];
    expect(resolveSyntheticMediaDisclosure({ provenance: serviceParams.provenance }).blocked).toBe(true);

    hoisted.forestYoutubeUpload.mockResolvedValueOnce({
      platformVideoId: 'yt-s1',
      status: 'published',
    });
    await dispatchPlatformUpload(
      'youtube_shorts',
      {
        videoId: 'vid-2',
        videoTitle: '100% guaranteed ROI',
        niche: 'ai_automation',
        hookArchetype: 'curiosity_gap',
        platforms: ['youtube_shorts'],
        videoUrl: 'https://r2.example/v.mp4',
        byokKeys: { youtubeApiKey: 'yt-key' },
      },
      'Earn $3,000 per week guaranteed.',
    );
    const shortsParams = hoisted.forestYoutubeUpload.mock.calls[0]![1];
    expect(resolveSyntheticMediaDisclosure({ provenance: shortsParams.provenance }).blocked).toBe(true);
  });

  it('attaches provenance in distributionFanout from plan metadata', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { access_token: 'enc' } });
    const chain: Record<string, unknown> = { maybeSingle, limit: () => chain };
    chain.eq = vi.fn(() => chain);
    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({ select: () => chain }),
    } as never);
    hoisted.getPlan.mockResolvedValueOnce({
      id: 'plan-1',
      workspace_id: 'ws-1',
      project_id: 'prj-1',
      asset_id: 'https://r2.example/v.mp4',
      channels: '["youtube"]',
      schedule_at: null,
      status: 'scheduled',
      metadata: JSON.stringify({
        title: 'Boost revenue by 90%',
        description: 'Boost revenue by 90% in 7 days.',
      }),
      created_at: 1,
      updated_at: 1,
    });
    hoisted.getPosts.mockResolvedValueOnce([{ id: 'post-1', platform: 'youtube' }]);
    hoisted.executePublish.mockResolvedValueOnce({
      ok: true,
      value: { platformVideoId: 'yt-fan-1', status: 'processing' },
    });

    const handler = (distributionFanout as unknown as { _handler: (ctx: unknown) => Promise<unknown> })._handler;
    await handler({
      event: { data: { planId: 'plan-1', workspaceId: 'ws-1' } },
      step: { run: async (_n: string, fn: () => Promise<unknown>) => fn() },
    });

    const fanoutParams = hoisted.executePublish.mock.calls[0]![2];
    expect(resolveSyntheticMediaDisclosure({ provenance: fanoutParams.provenance }).blocked).toBe(true);
  });

  it('prevents duplicate cron delivery from failing a job already claimed by the verified worker', async () => {
    vi.mocked(createServerClient).mockReturnValue({
      from: () => ({ update: hoisted.updateJob }),
    } as never);
    hoisted.findJobById.mockResolvedValueOnce({
      id: 'job-race-1',
      tenant_id: 'ws-1',
      provider: 'youtube',
      caption: 'Boost sales by 70% overnight',
      status: 'uploading',
    });
    hoisted.atomicClaimJob.mockResolvedValueOnce({ claimed: false, status: 'uploading' });

    const duplicateOutcome = await executePublishWorkflow({
      jobId: 'job-race-1',
      tenantId: 'ws-1',
      userId: 'system',
      provenance: {
        claims: [{ text: 'Boost sales by 70% overnight', status: 'pending' }],
      },
      step: { sleep: async () => undefined, run: async (_n, fn) => fn() },
      scheduleRetry: async () => undefined,
    });

    expect(duplicateOutcome.skipped).toBe(true);
    expect(hoisted.updateJob).not.toHaveBeenCalled();
  });
});
