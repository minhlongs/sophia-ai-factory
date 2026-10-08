/**
 * End-to-End Integration Test for Video-to-SDP Autonomous Loop
 * Tests full lifecycle: Pipeline Synthesis -> D1 Draft Store -> CEO Approval -> SDP Dispatch.
 *
 * Layer: forest/inngest/functions/__tests__ | File size: < 200 LOC | Zero :any
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@/seed/db/client';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';

const { mockInngestSend, mockGetCurrentUser, mockGetD1 } = vi.hoisted(() => ({
  mockInngestSend: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockGetD1: vi.fn(),
}));

vi.mock('@/forest/video/autonomous-video-orchestrator');
vi.mock('@/seed/db/client', () => ({
  getD1: mockGetD1,
  createServerClient: vi.fn(),
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mockInngestSend, createFunction: vi.fn() },
}));
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { processAutonomousVideoPipelineJob } from '../autonomous-video-pipeline-job';
import * as orchestrator from '@/forest/video/autonomous-video-orchestrator';
import {
  ensurePlatformCredentialsTable,
  upsertCredential,
} from '@/land/social/platform-credentials-store';
import {
  ensurePublishJobsTable,
  getPublishJob,
} from '@/land/social/publish-job-store';
import {
  listDraftPublishJobsAction,
  approveDraftPublishJobAction,
} from '@/land/social/actions/social-publisher-draft-actions';

describe('Video-to-SDP Autonomous Loop E2E Workflow', () => {
  let rawDb: ReturnType<typeof freshDb>;
  let d1: D1Database;

  const mockStep = {
    run: vi.fn().mockImplementation(async (_n: string, fn: () => Promise<unknown>) => fn()),
  };

  const userId = 'usr_ceo_enterprise_1';

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue({ ids: ['evt_e2e_dispatched'] });
    mockGetCurrentUser.mockResolvedValue({ id: userId, email: 'ceo@agencyos.network' });

    rawDb = freshDb();
    d1 = makeD1(rawDb) as unknown as D1Database;
    mockGetD1.mockResolvedValue(d1);

    await ensurePlatformCredentialsTable(d1);
    await ensurePublishJobsTable(d1);

    // Seed active YouTube Shorts & TikTok channels
    await upsertCredential(
      {
        userId,
        platform: 'YOUTUBE_SHORTS',
        channelId: 'yt_chan_101',
        channelName: '@SophiaAutomatedShorts',
        encryptedTokens: 'iv:tag:cipher_yt',
        tokenExpiresAt: Date.now() + 86400000,
        killSwitchActive: false,
      },
      d1,
    );

    await upsertCredential(
      {
        userId,
        platform: 'TIKTOK_V2',
        channelId: 'tt_chan_202',
        channelName: '@SophiaViralTikTok',
        encryptedTokens: 'iv:tag:cipher_tt',
        tokenExpiresAt: Date.now() + 86400000,
        killSwitchActive: false,
      },
      d1,
    );

    // Mock video generation synthesis output
    vi.mocked(orchestrator.runAutonomousVideoPipeline).mockResolvedValue({
      campaignId: 'camp_viral_99',
      manifest: {
        manifestId: 'mnf_viral_99',
        title: '7 AI Automation Tools For Fast Cashflow in 2026',
        niche: 'saas_global' as const,
        scriptText: 'Here are the top tools transforming agencies...',
      },
      hookVariantsGeneratedCount: 3,
    } as unknown as Awaited<ReturnType<typeof orchestrator.runAutonomousVideoPipeline>>);
  });

  it('completes the Draft-to-Approval loop when autoPublish is false', async () => {
    // 1. Inngest pipeline executes with autoPublish = false (Human-in-the-loop / Draft mode)
    const pipelineRes = await processAutonomousVideoPipelineJob({
      event: {
        data: {
          campaignId: 'camp_viral_99',
          userId,
          autoPublish: false,
          niche: 'saas_global',
          productName: 'AgencyOS Suite',
          productUrl: 'https://agencyos.network',
          productDescription: 'Complete operating system for AI agencies',
          affiliateBaseUrl: 'https://aff.agencyos.network',
          targetPlatforms: ['youtube_shorts', 'tiktok'],
        },
      },
      step: mockStep,
    });

    expect(pipelineRes.status).toBe('COMPLETED');
    const dist = pipelineRes.distribution as { jobsCreated: number; jobs: Array<{ jobId: string }> };
    expect(dist.jobsCreated).toBe(2);
    expect(mockInngestSend).not.toHaveBeenCalled(); // No immediate publish

    // 2. CEO inspects Drafts via Server Action
    const draftListRes = await listDraftPublishJobsAction(10);
    expect(draftListRes.success).toBe(true);
    expect(draftListRes.data?.length).toBe(2);
    expect(draftListRes.data?.[0]?.status).toBe('DRAFT');

    const draftToApprove = draftListRes.data![0];

    // 3. CEO clicks 1-Click Approval
    const approveRes = await approveDraftPublishJobAction(draftToApprove.id);
    expect(approveRes.success).toBe(true);
    expect(approveRes.data?.status).toBe('PENDING');

    // 4. Verify D1 DB updated to PENDING
    const updatedJob = await getPublishJob(draftToApprove.id, d1);
    expect(updatedJob?.status).toBe('PENDING');

    // 5. Inngest social.publish.dispatched event was triggered
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'social.publish.dispatched',
      data: expect.objectContaining({
        jobId: draftToApprove.id,
        userId,
        platform: draftToApprove.platform,
        title: '7 AI Automation Tools For Fast Cashflow in 2026',
      }),
    });
  });

  it('completes direct autonomous distribution when autoPublish is true', async () => {
    const pipelineRes = await processAutonomousVideoPipelineJob({
      event: {
        data: {
          campaignId: 'camp_viral_auto',
          userId,
          autoPublish: true,
          niche: 'saas_global',
          productName: 'AgencyOS Suite',
          productUrl: 'https://agencyos.network',
          productDescription: 'Complete operating system for AI agencies',
          affiliateBaseUrl: 'https://aff.agencyos.network',
          targetPlatforms: ['youtube_shorts'],
        },
      },
      step: mockStep,
    });

    expect(pipelineRes.status).toBe('COMPLETED');
    const dist = pipelineRes.distribution as { jobsCreated: number; jobs: Array<{ jobId: string }> };
    expect(dist.jobsCreated).toBe(1);

    // Inngest publish event fired immediately
    expect(mockInngestSend).toHaveBeenCalledTimes(1);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'social.publish.dispatched',
      data: expect.objectContaining({
        userId,
        platform: 'YOUTUBE_SHORTS',
        title: '7 AI Automation Tools For Fast Cashflow in 2026',
      }),
    });
  });
});
