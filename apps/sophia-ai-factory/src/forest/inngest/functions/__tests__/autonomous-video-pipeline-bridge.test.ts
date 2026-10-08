/**
 * Unit & Integration Tests for Autonomous Video Pipeline to SDP Bridge
 * Tests deterministic synthesis bridging into D1 draft/pending distribution jobs.
 * Layer: forest/inngest/functions/__tests__ | File size: < 200 LOC | Zero :any
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlatformCredentialRecord } from '@/seed/types/social-publisher-types';

const { mockInngestSend } = vi.hoisted(() => ({ mockInngestSend: vi.fn() }));

vi.mock('@/forest/video/autonomous-video-orchestrator');
vi.mock('@/land/social/platform-credentials-store');
vi.mock('@/land/social/publish-job-store');
vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mockInngestSend, createFunction: vi.fn() },
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processAutonomousVideoPipelineJob } from '../autonomous-video-pipeline-job';
import * as credStore from '@/land/social/platform-credentials-store';
import * as jobStore from '@/land/social/publish-job-store';
import * as orchestrator from '@/forest/video/autonomous-video-orchestrator';

describe('processAutonomousVideoPipelineJob - SDP Distribution Bridge', () => {
  const mockStep = {
    run: vi.fn().mockImplementation(async (_n: string, fn: () => Promise<unknown>) => fn()),
  };

  const samplePipelineSummary = {
    campaignId: 'camp_alpha_1',
    manifest: {
      manifestId: 'mnf_alpha_1',
      title: 'Top 5 AI Automation Tools for CEOs',
      niche: 'saas_global' as const,
      scriptText: 'Full viral script text...',
    },
    hookVariantsGeneratedCount: 3,
  };

  const baseCred = {
    userId: 'usr_ceo_42',
    encryptedTokens: 'iv:tag:cipher',
    tokenExpiresAt: Date.now() + 3600000,
    dailyPostCount: 0,
    killSwitchActive: false,
    lockVersion: 1,
    updatedAt: Date.now(),
  };

  const sampleYtCred: PlatformCredentialRecord = {
    ...baseCred,
    id: 'cred_yt_1',
    platform: 'YOUTUBE_SHORTS',
    channelId: 'chan_yt_1',
    channelName: 'CEO Shorts',
  };

  const sampleTkCred: PlatformCredentialRecord = {
    ...baseCred,
    id: 'cred_tk_1',
    platform: 'TIKTOK_V2',
    channelId: 'chan_tk_1',
    channelName: 'CEO TikTok',
  };

  const sampleEventData = {
    campaignId: 'camp_alpha_1',
    niche: 'saas_global' as const,
    productName: 'Sophia AI',
    productUrl: 'https://sophia.agencyos.network',
    productDescription: 'Autonomous video generation',
    affiliateBaseUrl: 'https://aff.sophia.agencyos.network',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue({ ids: ['evt_test_1'] });
    vi.mocked(orchestrator.runAutonomousVideoPipeline).mockResolvedValue(
      samplePipelineSummary as unknown as Awaited<ReturnType<typeof orchestrator.runAutonomousVideoPipeline>>,
    );
  });

  it('skips distribution when userId is not provided', async () => {
    const res = await processAutonomousVideoPipelineJob({
      event: { data: sampleEventData },
      step: mockStep,
    });
    expect(res.status).toBe('COMPLETED');
    expect(res.distribution).toEqual({ jobsCreated: 0, reason: 'NO_USER_ID' });
    expect(jobStore.createPublishJob).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('returns NO_ACTIVE_CHANNELS when user has no matching/active credentials', async () => {
    vi.mocked(credStore.listUserCredentials).mockResolvedValue([
      { ...sampleYtCred, killSwitchActive: true },
    ]);

    const res = await processAutonomousVideoPipelineJob({
      event: { data: { ...sampleEventData, userId: 'usr_ceo_42' } },
      step: mockStep,
    });
    expect(res.status).toBe('COMPLETED');
    expect(res.distribution).toEqual({ jobsCreated: 0, reason: 'NO_ACTIVE_CHANNELS' });
    expect(jobStore.createPublishJob).not.toHaveBeenCalled();
  });

  it('creates DRAFT jobs when autoPublish is false and does not dispatch inngest events', async () => {
    vi.mocked(credStore.listUserCredentials).mockResolvedValue([sampleYtCred, sampleTkCred]);
    vi.mocked(jobStore.createPublishJob).mockImplementation(async (input) => ({
      id: `pub_${input.channelId}`,
      userId: input.userId,
      channelId: input.channelId,
      platform: input.platform,
      videoUrl: input.videoUrl,
      title: input.title,
      description: input.description,
      status: input.status ?? 'DRAFT',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const res = await processAutonomousVideoPipelineJob({
      event: { data: { ...sampleEventData, userId: 'usr_ceo_42', autoPublish: false } },
      step: mockStep,
    });
    expect(res.status).toBe('COMPLETED');
    expect((res.distribution as { jobsCreated: number }).jobsCreated).toBe(2);
    expect(jobStore.createPublishJob).toHaveBeenCalledTimes(2);
    expect(jobStore.createPublishJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'usr_ceo_42', status: 'DRAFT' }),
    );
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('creates PENDING jobs and dispatches Inngest events when autoPublish is true', async () => {
    vi.mocked(credStore.listUserCredentials).mockResolvedValue([sampleYtCred]);
    vi.mocked(jobStore.createPublishJob).mockImplementation(async (input) => ({
      id: 'pub_yt_live',
      userId: input.userId,
      channelId: input.channelId,
      platform: input.platform,
      videoUrl: input.videoUrl,
      title: input.title,
      description: input.description,
      status: 'PENDING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const res = await processAutonomousVideoPipelineJob({
      event: {
        data: {
          ...sampleEventData,
          userId: 'usr_ceo_42',
          autoPublish: true,
          targetPlatforms: ['youtube_shorts'],
        },
      },
      step: mockStep,
    });
    expect(res.status).toBe('COMPLETED');
    expect((res.distribution as { jobsCreated: number }).jobsCreated).toBe(1);
    expect(jobStore.createPublishJob).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', platform: 'YOUTUBE_SHORTS' }),
    );
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'social.publish.dispatched',
      data: expect.objectContaining({
        jobId: 'pub_yt_live',
        userId: 'usr_ceo_42',
        platform: 'YOUTUBE_SHORTS',
      }),
    });
  });
});
