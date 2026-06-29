/**
 * Reddit Publisher Adapter — /api/submit via OAuth2.
 * Posts as link submission (kind=link) with video URL + caption as title.
 * Defaults to user profile (r/u_<username>) when no subreddit is configured.
 * Falls back to mock responses when REDDIT_CLIENT_ID is absent.
 */

import type { Publisher, PublishMeta, PublishStatus, MetricsJson } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const REDDIT_SUBMIT = `${REDDIT_OAUTH_BASE}/api/submit`;
const REDDIT_USER_AGENT = 'SophiaAIFactory/1.0';

function isMockMode(): boolean {
  return !process.env.REDDIT_CLIENT_ID;
}

interface RedditSubmitResponse {
  json?: {
    errors?: string[][];
    data?: { id?: string; name?: string; url?: string };
  };
}

interface RedditPostResponse {
  data?: { name?: string; is_video?: boolean; score?: number; num_comments?: number; ups?: number };
}

function buildTitle(meta: PublishMeta): string {
  const adCaption = meta.caption.startsWith('#ad ') ? meta.caption : `#ad ${meta.caption}`;
  return adCaption.slice(0, 300);
}

export interface RedditTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in: number;
  scope?: string;
}

/**
 * Refresh Reddit access token via OAuth2.
 * Uses HTTP Basic auth with client_id:client_secret.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RedditTokenResponse> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error('REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / NEXT_PUBLIC_APP_URL not set');
  }

  const res = await fetch(REDDIT_OAUTH_BASE + '/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_USER_AGENT,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      redirect_uri: `${appUrl}/api/oauth/reddit/callback`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Reddit token refresh failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<RedditTokenResponse>;
}

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

    const title = buildTitle(meta);
    // Post to user profile subreddit by default; can be overridden via meta.title as subreddit
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
      const text = await res.text().catch(() => '');
      throw new Error(`Reddit /api/submit failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as RedditSubmitResponse;
    const errors = data.json?.errors ?? [];
    if (errors.length > 0) {
      throw new Error(`Reddit submit errors: ${errors.map(e => e.join(': ')).join('; ')}`);
    }

    const postId = data.json?.data?.name ?? data.json?.data?.id;
    if (!postId) throw new Error('Reddit submit returned no post id');
    return postId;
  }

  async pollStatus(externalPostId: string): Promise<PublishStatus> {
    if (isMockMode() || externalPostId.startsWith('mock_')) return 'live';
    // Reddit posts are synchronous — just check the post exists
    const res = await fetch(`${REDDIT_OAUTH_BASE}/by_id/${externalPostId}.json`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    });
    if (res.status === 404) return 'failed';
    if (!res.ok) return 'failed';
    return 'live';
  }

  async getMetrics(externalPostId: string): Promise<MetricsJson> {
    if (isMockMode() || externalPostId.startsWith('mock_')) {
      return { views: 0, likes: 0, comments: 0 };
    }
    const res = await fetch(`${REDDIT_OAUTH_BASE}/by_id/${externalPostId}.json`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
    });
    if (!res.ok) return { views: 0, likes: 0, comments: 0 };
    const json = (await res.json()) as { data?: { children?: Array<{ data?: RedditPostResponse['data'] }> } };
    const post = json.data?.children?.[0]?.data;
    return {
      views: 0, // Reddit doesn't expose view counts via API
      likes: post?.ups ?? post?.score ?? 0,
      comments: post?.num_comments ?? 0,
    };
  }

async delete(postId: string): Promise<void> {
  // Platform-specific deletion not implemented
  logger.warn("[reddit.ts] delete not implemented");
}}