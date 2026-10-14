import type { PublishStatus, MetricsJson } from '../publisher-interface';
import { LI_API, VideoStatsResponse } from './types';

export async function checkPostStatus(
  accessToken: string,
  externalPostId: string
): Promise<PublishStatus> {
  const encodedUrn = encodeURIComponent(externalPostId);
  const res = await fetch(`${LI_API}/v2/posts/${encodedUrn}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202304',
    },
  });

  if (res.status === 404) return 'failed';
  if (!res.ok) return 'failed';
  return 'live';
}

export async function fetchPostMetrics(
  accessToken: string,
  externalPostId: string
): Promise<MetricsJson> {
  const encodedUrn = encodeURIComponent(externalPostId);
  const res = await fetch(
    `${LI_API}/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}&shares[0]=${encodedUrn}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );

  if (!res.ok) return { views: 0, likes: 0, comments: 0, shares: 0 };

  const data = (await res.json()) as VideoStatsResponse;
  const stats = data.elements?.[0]?.totalShareStatistics ?? {};
  return {
    views: stats.impressionCount ?? 0,
    likes: stats.likeCount ?? 0,
    comments: stats.commentCount ?? 0,
    shares: stats.shareCount ?? 0,
  };
}
