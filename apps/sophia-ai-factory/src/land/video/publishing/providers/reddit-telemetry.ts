/**
 * Reddit Post Status Polling & Metrics Retrieval
 *
 * @module land/video/publishing/providers/reddit-telemetry
 */

import type { PublishStatus, MetricsJson } from './publisher-interface';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  REDDIT_OAUTH_BASE,
  REDDIT_USER_AGENT,
  isMockMode,
  type RedditPostResponse,
} from './reddit-auth';

export async function pollRedditPostStatus(
  accessToken: string,
  externalPostId: string,
): Promise<PublishStatus> {
  if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';

  if (!shouldAllowRequest('reddit')) return 'processing';

  try {
    const res = await fetch(`${REDDIT_OAUTH_BASE}/by_id/${externalPostId}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    });
    if (res.status === 404) return 'failed';
    if (!res.ok) return 'failed';
    recordSuccess('reddit');
    return 'live';
  } catch (error) {
    recordFailure('reddit', classifyError(error));
    return 'processing';
  }
}

export async function fetchRedditPostMetrics(
  accessToken: string,
  externalPostId: string,
): Promise<MetricsJson> {
  if (isMockMode() || externalPostId.startsWith('mock_')) {
    return { views: 0, likes: 0, comments: 0 };
  }

  if (!shouldAllowRequest('reddit')) return { views: 0, likes: 0, comments: 0 };

  try {
    const res = await fetch(`${REDDIT_OAUTH_BASE}/by_id/${externalPostId}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    });
    if (!res.ok) return { views: 0, likes: 0, comments: 0 };
    const json = (await res.json()) as { data?: { children?: Array<{ data?: RedditPostResponse['data'] }> } };
    const post = json.data?.children?.[0]?.data;
    recordSuccess('reddit');
    return {
      views: 0, // Reddit doesn't expose view counts via API
      likes: post?.ups ?? post?.score ?? 0,
      comments: post?.num_comments ?? 0,
    };
  } catch (error) {
    recordFailure('reddit', classifyError(error));
    return { views: 0, likes: 0, comments: 0 };
  }
}
