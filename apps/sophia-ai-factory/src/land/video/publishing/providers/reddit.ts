/**
 * Reddit Publisher Adapter — /api/submit via OAuth2.
 * Posts as link submission (kind=link) with video URL + caption as title.
 * Defaults to user profile (r/u_<username>) when no subreddit is configured.
 * Falls back to mock responses when REDDIT_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  REDDIT_SUBMIT,
  REDDIT_USER_AGENT,
  isMockMode,
  buildTitle,
  refreshAccessToken,
  type RedditTokenResponse,
  type RedditSubmitResponse,
} from './reddit-auth';
import { pollRedditPostStatus, fetchRedditPostMetrics } from './reddit-telemetry';

export { refreshAccessToken, type RedditTokenResponse };

export class RedditPublisher implements Publisher {
  constructor(
    private readonly accessToken: string,
    /** Reddit username (without u/ prefix) for posting to user profile */
    private readonly username: string,
  ) {}

  async upload(videoUrl: string, meta: PublishMeta): Promise<string> {
    if (isMockMode()) {
      logger.warn('[RedditPublisher] Mock mode — REDDIT_CLIENT_ID missing');
      return `mock_reddit_${Date.now()}`;
    }

    if (!shouldAllowRequest('reddit')) {
      throw new Error('Circuit breaker open for reddit — upload blocked');
    }

    try {
      const title = buildTitle(meta);
      const subreddit = (meta.title && meta.title.startsWith('r/'))
        ? meta.title.slice(2)
        : `u_${this.username}`;

      const body = new URLSearchParams({
        kind: 'link',
        sr: subreddit,
        title,
        url: meta.productLink ?? videoUrl,
        resubmit: 'true',
        nsfw: 'false',
        api_type: 'json',
      });

      const res = await fetch(REDDIT_SUBMIT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': REDDIT_USER_AGENT,
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text().catch((err) => {
          logger.warn('Failed to read Reddit submit response', { error: String(err), context: 'RedditPublisher.upload' });
          return '';
        });
        throw new Error(`Reddit /api/submit failed (${res.status}): ${text.slice(0, 300)}`);
      }

      const data = (await res.json()) as RedditSubmitResponse;
      const errors = data.json?.errors ?? [];
      if (errors.length > 0) {
        throw new Error(`Reddit submit errors: ${errors.map(e => e.join(': ')).join('; ')}`);
      }

      const postId = data.json?.data?.name ?? data.json?.data?.id;
      if (!postId) throw new Error('Reddit submit returned no post id');
      recordSuccess('reddit');
      return postId;
    } catch (error) {
      recordFailure('reddit', classifyError(error));
      throw error;
    }
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    return pollRedditPostStatus(this.accessToken, externalPostId);
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    return fetchRedditPostMetrics(this.accessToken, externalPostId);
  }

  async delete(_postId: string): Promise<void> {
    logger.warn('[reddit.ts] delete not implemented');
  }
}
