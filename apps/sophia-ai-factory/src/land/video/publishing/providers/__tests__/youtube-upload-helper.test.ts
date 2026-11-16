/**
 * Unit tests for YouTube upload metadata builder and uploadToProvider forwarding.
 *
 * Verifies:
 * - Default privacyStatus remains 'public' when omitted (backward compatibility).
 * - Explicit privacyStatus ('unlisted' | 'private' | 'public') is honored.
 * - uploadToProvider forwards title, productLink, and privacyStatus from PublishingJob.
 *
 * @module land/video/publishing/providers/__tests__/youtube-upload-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildYouTubeMetadata, performResumableYouTubeUpload } from '../youtube-upload-helper';
import { YouTubePublisher } from '../youtube-publisher';
import { uploadToProvider } from '../../upload/upload-executor';
import * as publisherFactory from '../../upload/publisher-factory';
import * as circuitBreaker from '@/seed/security/circuit-breaker';
import type { PublishingChannel, PublishingJob } from '@/seed/types';
import type { PublishMeta } from '@/seed/types/channel-provider';

describe('buildYouTubeMetadata', () => {
  it('defaults privacyStatus to public when omitted', () => {
    const meta = buildYouTubeMetadata({
      caption: 'Honest review of Bybit vs Binance fees',
      hashtags: ['crypto', '#trading'],
      title: 'Bybit Review 2026',
      productLink: 'https://sophia.ai/r/bybit',
    });

    expect(meta.status).toEqual({
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
    });
    expect(meta.snippet.title).toBe('Bybit Review 2026');
    expect(meta.snippet.description).toContain('#ad Honest review of Bybit vs Binance fees');
    expect(meta.snippet.description).toContain('#crypto #trading');
    expect(meta.snippet.description).toContain('https://sophia.ai/r/bybit');
  });

  it('honors unlisted and private privacyStatus when specified', () => {
    const unlisted = buildYouTubeMetadata({
      caption: 'Apollo.io outbound demo',
      hashtags: ['saas'],
      privacyStatus: 'unlisted',
    });
    expect(unlisted.status.privacyStatus).toBe('unlisted');

    const priv = buildYouTubeMetadata({
      caption: 'Internal test',
      hashtags: [],
      privacyStatus: 'private',
    });
    expect(priv.status.privacyStatus).toBe('private');
  });

  // YouTube withholds monetization for a video published without the
  // disclosure, so the flag must be present even when no publisher passed it.
  it('declares synthetic media by default', () => {
    const meta = buildYouTubeMetadata({ caption: 'Clip', hashtags: ['tag1'] });
    expect(meta.status.containsSyntheticMedia).toBe(true);
  });

  it('honors an explicit non-synthetic declaration', () => {
    const meta = buildYouTubeMetadata({
      caption: 'Hand-recorded walkthrough',
      hashtags: [],
      containsSyntheticMedia: false,
    });
    expect(meta.status.containsSyntheticMedia).toBe(false);
  });

  it('throws PROVENANCE_BLOCKED with bilingual reason when provenance leaves claims unresolved', () => {
    expect(() =>
      buildYouTubeMetadata({
        caption: 'Unverified return claim',
        hashtags: ['finance'],
        provenance: {
          sources: [{ status: 'verified', id: 'src_1', url: 'https://example.test/a' }],
          claims: [
            {
              id: 'claim_1',
              text: 'Guaranteed 50% yield',
              riskLevel: 'high',
              sourceIds: [],
              status: 'unsupported',
            },
          ],
        },
      }),
    ).toThrow(
      /PROVENANCE_BLOCKED: The content review left claims without a verified source.*Bộ kiểm tra nội dung còn có khẳng định chưa xác minh được nguồn/,
    );
  });

  it('allows metadata build when every provenance claim is supported by a verified source', () => {
    const meta = buildYouTubeMetadata({
      caption: 'Backed review',
      hashtags: ['saas'],
      provenance: {
        sources: [{ status: 'verified', id: 'src_1', url: 'https://example.test/a' }],
        claims: [
          {
            id: 'claim_1',
            text: 'Official pricing tier',
            riskLevel: 'standard',
            sourceIds: ['src_1'],
            status: 'supported',
          },
        ],
      },
    });
    expect(meta.status.containsSyntheticMedia).toBe(true);
  });
});

describe('YouTubePublisher & performResumableYouTubeUpload provenance gate', () => {
  const prevClientId = process.env.YOUTUBE_CLIENT_ID;

  afterEach(() => {
    process.env.YOUTUBE_CLIENT_ID = prevClientId;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('blocks performResumableYouTubeUpload before fetching video bytes or session URI', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      performResumableYouTubeUpload('token_land', 'https://r2.sophia.local/v.mp4', {
        caption: 'Blocked clip',
        hashtags: [],
        provenance: {
          claims: [{ id: 'c_1', text: 'Unsupported', riskLevel: 'high', sourceIds: [], status: 'unsupported' }],
        },
      }),
    ).rejects.toThrow(/PROVENANCE_BLOCKED/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks YouTubePublisher.upload before touching shouldAllowRequest or recordFailure', async () => {
    process.env.YOUTUBE_CLIENT_ID = 'yt_client_live';
    const allowSpy = vi.spyOn(circuitBreaker, 'shouldAllowRequest');
    const failSpy = vi.spyOn(circuitBreaker, 'recordFailure');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const publisher = new YouTubePublisher('token_land');
    await expect(
      publisher.upload('https://r2.sophia.local/v.mp4', {
        caption: 'Blocked clip',
        hashtags: [],
        provenance: {
          claims: [{ id: 'c_1', text: 'Unsupported', riskLevel: 'high', sourceIds: [], status: 'unsupported' }],
        },
      }),
    ).rejects.toThrow(/PROVENANCE_BLOCKED/);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(allowSpy).not.toHaveBeenCalled();
    expect(failSpy).not.toHaveBeenCalled();
  });
});

describe('uploadToProvider metadata forwarding', () => {
  const mockUpload = vi.fn<(videoUrl: string, meta: PublishMeta) => Promise<string>>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue('yt_vid_123');
    vi.spyOn(publisherFactory, 'buildPublisher').mockReturnValue({
      upload: mockUpload,
      pollStatus: vi.fn(),
      getMetrics: vi.fn(),
    });
  });

  it('forwards title, productLink, and privacyStatus from PublishingJob to publisher.upload', async () => {
    const channel: PublishingChannel = {
      id: 'ch_1',
      tenant_id: 'ws_1',
      user_id: 'usr_1',
      provider: 'youtube',
      external_account_id: 'UC_owner_channel',
      display_name: 'Owner YouTube',
      access_token: 'enc_tok',
      refresh_token: null,
      expires_at: null,
      status: 'active',
      refreshing_at: null,
      created_at: 1,
      updated_at: 1,
    };

    const job: PublishingJob = {
      id: 'job_1',
      tenant_id: 'ws_1',
      video_id: 'vid_1',
      channel_id: 'ch_1',
      provider: 'youtube',
      status: 'uploading',
      caption: 'Apollo.io workflow breakdown',
      hashtags_json: JSON.stringify(['b2bsaas', 'sales']),
      title: 'Apollo.io Review — Gate 1 Unlisted Proof',
      product_link: 'https://sophia.ai/r/apollo',
      privacy_status: 'unlisted',
      scheduled_at: null,
      retry_count: 0,
      created_at: 1,
      updated_at: 1,
    };

    const res = await uploadToProvider({
      channel,
      accessToken: 'plain_token',
      videoUrl: 'https://r2.sophia.local/renders/run_1/final.mp4',
      job,
      db: {} as never,
      jobId: 'job_1',
      retryCount: 0,
      scheduleRetry: vi.fn(),
      tenantId: 'ws_1',
      userId: 'usr_1',
    });

    expect(res).toEqual({ externalPostId: 'yt_vid_123', shouldRetry: false });
    expect(mockUpload).toHaveBeenCalledWith(
      'https://r2.sophia.local/renders/run_1/final.mp4',
      {
        caption: 'Apollo.io workflow breakdown',
        hashtags: ['b2bsaas', 'sales'],
        title: 'Apollo.io Review — Gate 1 Unlisted Proof',
        productLink: 'https://sophia.ai/r/apollo',
        privacyStatus: 'unlisted',
      },
    );
  });

  it('marks job failed without scheduling a retry when upload rejects with PROVENANCE_BLOCKED', async () => {
    const blockedReason =
      'PROVENANCE_BLOCKED: The content review left claims without a verified source (Bộ kiểm tra nội dung còn có khẳng định chưa xác minh được nguồn)';
    mockUpload.mockRejectedValueOnce(new Error(blockedReason));

    const eqSpy = vi.fn().mockResolvedValue({});
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const scheduleRetry = vi.fn();

    const channel: PublishingChannel = {
      id: 'ch_1',
      tenant_id: 'ws_1',
      user_id: 'usr_1',
      provider: 'youtube',
      external_account_id: 'UC_owner_channel',
      display_name: 'Owner YouTube',
      access_token: 'enc_tok',
      refresh_token: null,
      expires_at: null,
      status: 'active',
      refreshing_at: null,
      created_at: 1,
      updated_at: 1,
    };

    const job: PublishingJob = {
      id: 'job_blocked_1',
      tenant_id: 'ws_1',
      video_id: 'vid_1',
      channel_id: 'ch_1',
      provider: 'youtube',
      status: 'uploading',
      caption: 'Blocked video',
      hashtags_json: '[]',
      title: 'Blocked Title',
      product_link: null,
      privacy_status: 'private',
      scheduled_at: null,
      retry_count: 0,
      created_at: 1,
      updated_at: 1,
    };

    const res = await uploadToProvider({
      channel,
      accessToken: 'plain_token',
      videoUrl: 'https://r2.sophia.local/renders/run_1/final.mp4',
      job,
      db: { from: fromSpy } as never,
      jobId: 'job_blocked_1',
      retryCount: 0,
      scheduleRetry,
      tenantId: 'ws_1',
      userId: 'usr_1',
    });

    expect(res).toEqual({
      externalPostId: '',
      shouldRetry: false,
      error: blockedReason,
    });
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: blockedReason,
        finished_at: expect.any(Number),
      }),
    );
  });

  it('forwards provenance through uploadToProvider into real YouTubePublisher and fails without retry on unresolved claims', async () => {
    vi.restoreAllMocks();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const eqSpy = vi.fn().mockResolvedValue({});
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const scheduleRetry = vi.fn();

    const channel: PublishingChannel = {
      id: 'ch_real_yt',
      tenant_id: 'ws_1',
      user_id: 'usr_1',
      provider: 'youtube',
      external_account_id: 'UC_owner_channel',
      display_name: 'Owner YouTube',
      access_token: 'enc_tok',
      refresh_token: null,
      expires_at: null,
      status: 'active',
      refreshing_at: null,
      created_at: 1,
      updated_at: 1,
    };

    const job: PublishingJob = {
      id: 'job_real_blocked',
      tenant_id: 'ws_1',
      video_id: 'vid_1',
      channel_id: 'ch_real_yt',
      provider: 'youtube',
      status: 'uploading',
      caption: 'Unverified health claim',
      hashtags_json: '[]',
      title: 'Unverified Claim',
      product_link: null,
      privacy_status: 'private',
      scheduled_at: null,
      retry_count: 0,
      created_at: 1,
      updated_at: 1,
    };

    const res = await uploadToProvider({
      channel,
      accessToken: 'plain_token',
      videoUrl: 'https://r2.sophia.local/renders/run_1/final.mp4',
      job,
      db: { from: fromSpy } as never,
      jobId: 'job_real_blocked',
      retryCount: 0,
      scheduleRetry,
      tenantId: 'ws_1',
      userId: 'usr_1',
      provenance: {
        claims: [{ id: 'c_1', text: 'Unproven claim', riskLevel: 'high', sourceIds: [], status: 'unsupported' }],
      },
    });

    expect(res.externalPostId).toBe('');
    expect(res.shouldRetry).toBe(false);
    expect(res.error).toMatch(/^PROVENANCE_BLOCKED:/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        error: expect.stringMatching(/^PROVENANCE_BLOCKED:/),
        finished_at: expect.any(Number),
      }),
    );
  });
});
