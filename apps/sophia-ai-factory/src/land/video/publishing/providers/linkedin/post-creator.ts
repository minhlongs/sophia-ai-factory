import type { PublishMeta } from '../publisher-interface';
import { LI_API, MAX_COMMENTARY_LEN, PostCreateResponse } from './types';

export function formatCommentary(meta: PublishMeta): string {
  const hashtags = meta.hashtags.map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  return `${meta.caption}\n\n${hashtags}${meta.productLink ? `\n\n${meta.productLink}` : ''}`.slice(
    0,
    MAX_COMMENTARY_LEN
  );
}

export async function createLinkedInPost(
  accessToken: string,
  authorUrn: string,
  assetUrn: string,
  meta: PublishMeta
): Promise<string> {
  const commentary = formatCommentary(meta);

  const postRes = await fetch(`${LI_API}/v2/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202304',
    },
    body: JSON.stringify({
      author: authorUrn,
      commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: (meta.title ?? meta.caption).slice(0, 200),
          id: assetUrn,
        },
      },
      contentCallToActionLabel: meta.productLink ? 'LEARN_MORE' : undefined,
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!postRes.ok) {
    const text = await postRes.text();
    throw new Error(`[LinkedInPublisher] Post creation failed (${postRes.status}): ${text}`);
  }

  const postData = (await postRes.json()) as PostCreateResponse;
  return postData.id;
}
