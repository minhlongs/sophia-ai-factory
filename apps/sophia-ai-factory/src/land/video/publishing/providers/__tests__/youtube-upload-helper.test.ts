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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildYouTubeMetadata } from '../youtube-upload-helper';
import { uploadToProvider } from '../../upload/upload-executor';
import * as publisherFactory from '../../upload/publisher-factory';
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
});
