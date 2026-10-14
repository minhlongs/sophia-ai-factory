/**
 * X/Twitter Publisher Adapter — chunked /2/media/upload + tweet creation.
 * Constraints: video ≤ 512MB, ≤ 140s; tweet text ≤ 280 chars (Free/Basic).
 * Falls back to mock 200 responses when TWITTER_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  X_API,
  uploadChunkedTwitterMedia,
  createTweetWithMedia,
  type TweetMetricsResponse,
} from './twitter-media-helpers';

function isMockMode(): boolean {
  return !process.env.TWITTER_CLIENT_ID;
}

export class TwitterPublisher implements Publisher {
  constructor(private readonly accessToken: string) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[TwitterPublisher] Mock mode — TWITTER_CLIENT_ID missing');
      return `mock_twitter_${Date.now()}`;
    }

    if (!shouldAllowRequest('twitter')) {
      throw new Error('Circuit breaker open for Twitter — too many failures');
    }

    try {
      const mediaId = await uploadChunkedTwitterMedia(videoUrl, this.accessToken);
      const tweetId = await createTweetWithMedia(this.accessToken, meta, mediaId);
      recordSuccess('twitter');
      return tweetId;
    } catch (error) {
      recordFailure('twitter', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    if (!shouldAllowRequest('twitter')) return 'processing';
    try {
      const res = await fetch(`${X_API}/2/tweets/${externalPostId}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.status === 404) return 'failed';
      if (res.ok) {
        recordSuccess('twitter');
        return 'live';
      }
      return 'processing';
    } catch (error) {
      recordFailure('twitter', classifyError(error));
      throw error;
    }
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
    if (!shouldAllowRequest('twitter')) return { views: 0, likes: 0, comments: 0, shares: 0 };
    try {
      const res = await fetch(
        `${X_API}/2/tweets/${externalPostId}?tweet.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      if (!res.ok) return { views: 0, likes: 0, comments: 0, shares: 0 };
      const data = (await res.json()) as TweetMetricsResponse;
      const m = data.data?.public_metrics ?? {};
      recordSuccess('twitter');
      return {
        views: m.impression_count ?? 0,
        likes: m.like_count ?? 0,
        comments: m.reply_count ?? 0,
        shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
      };
    } catch (error) {
      recordFailure('twitter', classifyError(error));
      return { views: 0, likes: 0, comments: 0, shares: 0 };
    }
  }

  async delete(_postId: string): Promise<void> {
    logger.warn('[twitter-publisher.ts] delete not implemented');
  }
}
