/**
 * Facebook Publisher Adapter — Page Reels via Graph API v21.0.
 * Single-call /video_reels with file_url + video_state=PUBLISHED (KISS).
 * Page Access Tokens never expire (NEVER_EXPIRES) when derived from long-lived user token.
 * Falls back to mock 200 responses when FACEBOOK_APP_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  GRAPH_BASE,
  isMockMode,
  buildFacebookReelDescription,
  parseFacebookInsights,
  type FBVideoResponse,
  type FBInsightsResponse,
} from './facebook-publisher-helpers';

export class FacebookPublisher implements Publisher {
  constructor(
    private readonly pageAccessToken: string,
    private readonly pageId: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[FacebookPublisher] Mock mode — FACEBOOK_APP_ID missing');
      return `mock_facebook_${Date.now()}`;
    }

    if (!shouldAllowRequest('facebook')) {
      throw new Error('Circuit breaker open for Facebook — too many failures');
    }

    try {
      const description = buildFacebookReelDescription(meta);

      const res = await fetch(`${GRAPH_BASE}/${this.pageId}/video_reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: videoUrl,
          description,
          video_state: 'PUBLISHED',
          access_token: this.pageAccessToken,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Facebook video_reels publish failed (${res.status}): ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as FBVideoResponse;
      if (!data.id) {
        throw new Error(`Facebook publish returned no id: ${data.error?.message ?? 'unknown'}`);
      }

      recordSuccess('facebook');
      return data.id;
    } catch (error) {
      recordFailure('facebook', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

    if (!shouldAllowRequest('facebook')) return 'processing';

    try {
      const res = await fetch(
        `${GRAPH_BASE}/${externalPostId}?fields=status&access_token=${this.pageAccessToken}`,
      );

      if (!res.ok) return 'failed';

      const data = (await res.json()) as FBVideoResponse;
      const code = data.status?.video_status;

      if (code === 'ready') return 'live';
      if (code === 'error') return 'failed';
      return 'processing';
    } catch (error) {
      recordFailure('facebook', classifyError(error));
      return 'processing';
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }

    if (!shouldAllowRequest('facebook')) return { views: 0, likes: 0, comments: 0 };

    try {
      const metrics = 'total_video_impressions,total_video_views,post_video_likes_by_reaction_type';
      const res = await fetch(
        `${GRAPH_BASE}/${externalPostId}/video_insights?metric=${metrics}&access_token=${this.pageAccessToken}`,
      );

      if (!res.ok) return { views: 0, likes: 0, comments: 0 };

      const data = (await res.json()) as FBInsightsResponse;
      return parseFacebookInsights(data);
    } catch (error) {
      recordFailure('facebook', classifyError(error));
      return { views: 0, likes: 0, comments: 0 };
    }
  }

  async delete(_postId: string): Promise<void> {
    // Platform-specific deletion not implemented
    logger.warn('[facebook-publisher.ts] delete not implemented');
  }
}
