/**
 * Unit and dispatcher-wiring tests for deterministic `producePublishProvenance`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  inngestSend: vi.fn(),
  distribute: vi.fn(),
  selfHeal: vi.fn(),
  resolveAudienceJurisdiction: vi.fn(),
  listUserCredentials: vi.fn(),
  createPublishJob: vi.fn(),
  transitionDraftToPending: vi.fn(),
  getCurrentUser: vi.fn(),
  enforceCommercialFeatureForUser: vi.fn(),
  consumeQuota: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: hoisted.inngestSend, createFunction: vi.fn() },
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/tree/affiliates/audience-jurisdiction', () => ({
  resolveAudienceJurisdiction: hoisted.resolveAudienceJurisdiction,
}));
vi.mock('@/tree/gateway/openclaw-gateway', () => ({
  OpenClawGateway: class {
    registerChannel = vi.fn();
    distribute = hoisted.distribute;
    selfHeal = hoisted.selfHeal;
  },
}));
vi.mock('@/land/youtube/youtube-oauth-client', () => ({
  uploadVideo: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
vi.mock('@/land/tiktok/tiktok-oauth-client', () => ({
  publishVideo: vi.fn(),
  checkPublishStatus: vi.fn(),
}));
vi.mock('@/land/social/platform-credentials-store', () => ({
  listUserCredentials: hoisted.listUserCredentials,
  getCredential: vi.fn(async () => ({ killSwitchActive: false })),
  upsertCredential: vi.fn(),
}));
vi.mock('@/land/social/publish-job-store', () => ({
  createPublishJob: hoisted.createPublishJob,
  transitionDraftToPending: hoisted.transitionDraftToPending,
  listUserDraftJobs: vi.fn(async () => []),
  toSocialPublishResult: vi.fn((job: { id: string; platform: string; status: string }) => ({
    jobId: job.id,
    platform: job.platform,
    status: job.status,
  })),
}));
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: hoisted.getCurrentUser,
}));
vi.mock('@/seed/config/enforce-commercial-feature-server', () => ({
  enforceCommercialFeatureForUser: hoisted.enforceCommercialFeatureForUser,
}));
vi.mock('@/forest/publishing/per-channel-quota', () => ({
  consumeQuota: hoisted.consumeQuota,
}));

import { generateMockScript } from '@/seed/ai/script-prompt-builders';
import {
  PROVENANCE_BLOCKED_PREFIX,
  assertYouTubeProvenanceAllowed,
  resolveSyntheticMediaDisclosure,
} from '@/tree/publishing/synthetic-media-disclosure';
import {
  extractVerifiableClaims,
  producePublishProvenance,
} from '@/tree/youtube-strategy/provenance-producer';
import { runDistribution } from '@/forest/inngest/functions/campaign/distribution-gateway';
import { runDistributeStep } from '@/land/video/generation/orchestrator/callback-processor';
import { dispatchSocialDistributionForPipeline } from '@/forest/inngest/functions/autonomous-video-pipeline-distribution';
import { sendSocialPublishDispatchedEvent } from '@/app/actions/social-publisher-helpers';
import { approveDraftPublishJobAction } from '@/land/social/actions/social-publisher-draft-actions';

describe('producePublishProvenance deterministic claim/source scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.inngestSend.mockResolvedValue({ ids: ['evt-1'] });
    hoisted.resolveAudienceJurisdiction.mockResolvedValue('US');
    hoisted.distribute.mockResolvedValue({
      campaignId: 'camp-1',
      allSucceeded: true,
      results: [{ channelId: 'youtube', success: true }],
    });
    hoisted.getCurrentUser.mockResolvedValue({ id: 'user-1', email: 'ceo@example.com' });
    hoisted.enforceCommercialFeatureForUser.mockResolvedValue({ ok: true });
  });

  it('passes clean narrative scripts and mock scripts with containsSyntheticMedia = true and 0 claims', () => {
    const mockScript = generateMockScript('AI Workflows', 'agency founders');
    const provenance = producePublishProvenance({
      title: 'Top 5 Productivity Workflows in 2026 (1080p 24/7)',
      description:
        'Follow these 3 simple steps in 15 seconds. #ad | This content contains affiliate links and I may earn a commission at no cost to you. https://sophia.agencyos.network/r/99',
      script: mockScript,
    });

    expect(provenance).toEqual({ containsSyntheticMedia: true });
    const disclosure = resolveSyntheticMediaDisclosure({ provenance });
    expect(disclosure.blocked).toBe(false);
    expect(disclosure.containsSyntheticMedia).toBe(true);
    expect(disclosure.provenanceStatus).toBe('not_required');
  });

  it('blocks unverified quantitative, monetary, and medical claims in English and Vietnamese', () => {
    const cases = [
      'This workflow is clinically proven to boost conversion rates by 85% in one week.',
      'Earn $5,000 per month passive income with zero effort.',
      'Phương pháp nghiên cứu chứng minh giúp tăng doanh thu 92% và kiếm 50 triệu mỗi tháng.',
      'Sản phẩm được FDA chấp thuận giúp bạn bỏ túi $500 mỗi ngày.',
    ];

    for (const scriptText of cases) {
      expect(extractVerifiableClaims(scriptText).length).toBeGreaterThan(0);
      const provenance = producePublishProvenance({ title: 'Claim Video', scriptText });
      const disclosure = resolveSyntheticMediaDisclosure({ provenance });
      expect(disclosure.blocked).toBe(true);
      expect(disclosure.provenanceStatus).toBe('blocked');
      expect(() => assertYouTubeProvenanceAllowed(disclosure)).toThrow(
        new RegExp(`^${PROVENANCE_BLOCKED_PREFIX}`),
      );
    }
  });

  it('never throws on malformed or duplicate sources at dispatch time while still blocking YouTube at upload time', () => {
    const provenance = producePublishProvenance({
      title: 'Quick Tip',
      description: 'Clean narrative caption for TikTok and YouTube.',
      sources: [{ url: 'not-a-valid-url', status: 'verified' }],
    });

    expect(provenance.containsSyntheticMedia).toBe(true);
    expect(provenance.sources).toEqual([{ url: 'not-a-valid-url', status: 'verified' }]);
    expect(() => resolveSyntheticMediaDisclosure({ provenance })).toThrow(
      new RegExp(`^${PROVENANCE_BLOCKED_PREFIX}`),
    );
  });

  it('still scans text claims when caller passes provenance without explicit claims or with empty/partial claims', () => {
    const provenance = producePublishProvenance({
      title: 'Clinically proven to cure diabetes',
      provenance: { containsSyntheticMedia: true },
    });

    expect(Array.isArray(provenance.claims)).toBe(true);
    expect(provenance.claims?.length).toBe(1);
    expect(resolveSyntheticMediaDisclosure({ provenance }).blocked).toBe(true);

    const bypassAttempt = producePublishProvenance({
      title: 'Clinically proven to cure cancer',
      description: 'Earn $10,000 per month passive income guaranteed',
      provenance: { claims: [] },
    });
    expect(bypassAttempt.claims?.length).toBe(2);
    expect(resolveSyntheticMediaDisclosure({ provenance: bypassAttempt }).blocked).toBe(true);
  });

  it('retains high-risk claims when accompanied by inline or multi-scene disclaimers, NFD Vietnamese, inflected verbs, and >500-char segments while allowing "tỷ lệ"', () => {
    // Inline disclaimer cannot erase a claim on the same line
    const inlineDisclaimer = extractVerifiableClaims(
      'Earn $10,000 per month passive income guaranteed! Not financial advice.',
    );
    expect(inlineDisclaimer.length).toBe(1);

    // Multi-scene script with a disclaimer scene still flags earlier claim scenes
    const multiScene = producePublishProvenance({
      script: {
        title: 'Bot Demo',
        scenes: [
          { narration: 'Use this bot to earn $10,000 per month passive income guaranteed.' },
          { narration: 'Disclaimer: not financial advice.' },
        ],
      },
    });
    expect(resolveSyntheticMediaDisclosure({ provenance: multiScene }).blocked).toBe(true);

    // Decomposed NFD Vietnamese + inflected English verbs + >500-char unpunctuated tail claim
    const nfdVi = 'Kiếm 50 triệu mỗi tháng tại nhà.'.normalize('NFD');
    expect(extractVerifiableClaims(nfdVi).length).toBe(1);
    expect(extractVerifiableClaims('This AI workflow increased revenue by 85% in 7 days.').length).toBe(1);
    expect(extractVerifiableClaims('He earned $10,000 in 3 days with this bot.').length).toBe(1);
    const longUnpunctuated = `${'word '.repeat(130)}boosted conversion by 75% overnight`;
    expect(extractVerifiableClaims(longUnpunctuated).length).toBe(1);

    // Benign Vietnamese "tỷ lệ" (ratio) is NOT mistaken for "tỷ" (billion)
    expect(extractVerifiableClaims('Cách tính thu nhập theo 3 tỷ lệ phân bổ ngân sách.')).toEqual([]);

    // Malformed non-array provenance.sources is preserved so YouTube fails closed
    const nonArraySources = producePublishProvenance({
      title: 'Clean title',
      provenance: { sources: { url: 'not-a-valid-url' } as unknown as readonly Record<string, unknown>[] },
    });
    expect(() => resolveSyntheticMediaDisclosure({ provenance: nonArraySources })).toThrow(
      new RegExp(`^${PROVENANCE_BLOCKED_PREFIX}`),
    );

    // Short waived caller claim ("a") or 100 dummy waived claims cannot mask extracted claims
    const shortWaivedBypass = producePublishProvenance({
      scriptText: 'Earn $10,000 per month passive income guaranteed.',
      provenance: {
        claims: [{ text: 'a', status: 'waived', notes: 'reviewed' }],
      },
    });
    expect(resolveSyntheticMediaDisclosure({ provenance: shortWaivedBypass }).blocked).toBe(true);

    const hundredDummyWaived = Array.from({ length: 100 }, (_, i) => ({
      id: `dummy_${i}`,
      text: `benign statement ${i}`,
      status: 'waived',
      notes: 'reviewed',
    }));
    const floodBypass = producePublishProvenance({
      scriptText: 'Clinically proven to cure cancer overnight.',
      provenance: { claims: hundredDummyWaived },
    });
    expect(resolveSyntheticMediaDisclosure({ provenance: floodBypass }).blocked).toBe(true);

    // Oversized 60k description cannot truncate spoken scriptText / script scenes out of the scan
    const paddedDescription = producePublishProvenance({
      description: 'benign narrative padding '.repeat(2600),
      scriptText: 'Clinically proven to cure diabetes and boost ROI by 95%.',
    });
    expect(resolveSyntheticMediaDisclosure({ provenance: paddedDescription }).blocked).toBe(true);
  });

  it('completes linear-time scanning under pathological punctuation and comma-digit inputs', () => {
    const start = performance.now();
    const commaFlood = `${'1,'.repeat(10_000)}x`;
    const dotFlood = `${'.'.repeat(20_000)}a`;
    expect(extractVerifiableClaims(commaFlood)).toEqual([]);
    expect(extractVerifiableClaims(dotFlood)).toEqual([]);
    expect(performance.now() - start).toBeLessThan(150);
  });

  it('resolves extracted claims to verified when backed by at least one verified source', () => {
    const provenance = producePublishProvenance({
      title: 'Benchmark Report',
      scriptText: 'Our peer-reviewed study reduced churn by 42% across cohorts.',
      sources: [
        {
          id: 'src_bench_2026',
          url: 'https://research.example.org/churn-study-2026',
          title: 'SaaS Churn Study 2026',
          sourceType: 'official',
          status: 'verified',
        },
      ],
    });

    const disclosure = resolveSyntheticMediaDisclosure({ provenance });
    expect(disclosure.blocked).toBe(false);
    expect(disclosure.provenanceStatus).toBe('verified');
    expect(disclosure.containsSyntheticMedia).toBe(true);
    expect(() => assertYouTubeProvenanceAllowed(disclosure)).not.toThrow();
  });

  it('threads blocked provenance from campaign scripts and pipeline/draft dispatchers into events', async () => {
    const riskyScript = {
      title: 'Guaranteed Returns',
      scenes: [
        { narration: 'Use this bot to earn $8,000 per month passive income guaranteed.' },
      ],
    };

    await runDistribution({
      campaignId: 'camp-prov-1',
      userId: 'user-1',
      videoUrl: 'https://cdn.example/v.mp4',
      thumbnailUrl: '',
      title: 'Automation Guide',
      audience: 'founders',
      tier: 'BASIC',
      affiliateOffer: null,
      script: riskyScript,
    });
    const distPayload = hoisted.distribute.mock.calls[0]![0];
    expect(resolveSyntheticMediaDisclosure({ provenance: distPayload.provenance }).blocked).toBe(true);

    await runDistributeStep({
      campaignId: 'camp-prov-2',
      videoUrl: 'https://cdn.example/v.mp4',
      title: 'Automation Guide',
      audience: 'founders',
      tier: 'BASIC',
      affiliateOffer: null,
      tenantId: 'user-1',
      jurisdiction: 'US',
      script: riskyScript,
    });
    const stepPayload = hoisted.distribute.mock.calls[1]![0];
    expect(resolveSyntheticMediaDisclosure({ provenance: stepPayload.provenance }).blocked).toBe(true);

    hoisted.listUserCredentials.mockResolvedValueOnce([
      {
        id: 'cred-yt',
        userId: 'user-1',
        platform: 'YOUTUBE_SHORTS',
        channelId: 'yt-1',
        channelName: 'YT',
        encryptedTokens: 'enc',
        tokenExpiresAt: Date.now() + 60_000,
        dailyPostCount: 0,
        killSwitchActive: false,
        lockVersion: 1,
        updatedAt: Date.now(),
      },
    ]);
    hoisted.createPublishJob.mockResolvedValueOnce({
      id: 'job-pipe-1',
      status: 'PENDING',
    });

    await dispatchSocialDistributionForPipeline(
      { campaignId: 'camp-pipe', userId: 'user-1', autoPublish: true, niche: 'saas_global' },
      {
        success: true,
        campaignId: 'camp-pipe',
        manifest: {
          manifestId: 'm-1',
          campaignId: 'camp-pipe',
          niche: 'saas_global',
          title: '100% guaranteed profit strategy',
          scriptText: 'Increase conversion by 75% overnight.',
        } as never,
        hookVariantsGeneratedCount: 1,
        totalBrollCuts: 1,
        totalSfxCues: 1,
        estimatedRenderTimeSeconds: 5,
      },
    );

    const pipeEvent = hoisted.inngestSend.mock.calls[0]![0];
    expect(resolveSyntheticMediaDisclosure({ provenance: pipeEvent.data.provenance }).blocked).toBe(true);

    await sendSocialPublishDispatchedEvent(
      {
        id: 'job-act-1',
        channelId: 'yt-1',
        platform: 'YOUTUBE_SHORTS',
        videoUrl: 'https://cdn.example/v.mp4',
        title: 'Clinically proven formula',
        description: 'Clinically proven to cure insomnia in 2 days.',
      },
      'user-1',
    );
    const actEvent = hoisted.inngestSend.mock.calls[1]![0];
    expect(resolveSyntheticMediaDisclosure({ provenance: actEvent.data.provenance }).blocked).toBe(true);

    hoisted.transitionDraftToPending.mockResolvedValueOnce({
      id: 'job-draft-1',
      userId: 'user-1',
      channelId: 'yt-1',
      platform: 'YOUTUBE_SHORTS',
      videoUrl: 'https://cdn.example/v.mp4',
      title: 'Kiếm 50 triệu mỗi tháng',
      description: 'Bí quyết kiếm 50 triệu mỗi tháng tại nhà.',
      tags: ['shorts'],
      status: 'PENDING',
    });
    await approveDraftPublishJobAction('job-draft-1');
    const draftEvent = hoisted.inngestSend.mock.calls[2]![0];
    expect(resolveSyntheticMediaDisclosure({ provenance: draftEvent.data.provenance }).blocked).toBe(true);
  });
});
