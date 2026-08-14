import { shouldAllowRequest, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import type { PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';

const IG_API = 'https://graph.facebook.com/v19.0';
const _MAX_DURATION_SEC = 90;

export const instagramAdapter: PlatformAdapter = {
  platform: 'instagram',

  async uploadVideo(accessToken: string, params: PublishParams): Promise<PublishResult> {
    if (!shouldAllowRequest('instagram')) {
      throw new Error('[instagram-adapter] Circuit breaker open for instagram');
    }
    try {
      // Instagram Reels: two-step container → publish flow
    // igUserId is stored in credential metadata and passed via accessToken prefix: "igUserId:token"
    const [igUserId, token] = accessToken.includes(':')
      ? accessToken.split(':', 2)
      : ['me', accessToken];

    const containerRes = await fetch(`${IG_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_url: params.videoUrl,
        media_type: 'REELS',
        caption: `${params.title}\n\n${params.description}`,
        share_to_feed: true,
        access_token: token,
      }),
    });

    if (!containerRes.ok) {
      const err = await containerRes.text();
      throw new Error(`Instagram container creation failed: ${containerRes.status} ${err}`);
    }

    const container = await containerRes.json() as { id: string };

    // Poll container status before publishing (Instagram requires processing time)
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const statusRes = await fetch(
        `${IG_API}/${container.id}?fields=status_code&access_token=${token}`,
      );
      const statusData = await statusRes.json() as { status_code: string };
      if (statusData.status_code === 'FINISHED') {
        ready = true;
        break;
      }
      if (statusData.status_code === 'ERROR') {
        throw new Error('Instagram container processing failed');
      }
      await new Promise((r) => setTimeout(r, 5000));
    }

    if (!ready) throw new Error('Instagram container processing timeout');

    const publishRes = await fetch(`${IG_API}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: token,
      }),
    });

    if (!publishRes.ok) {
      const err = await publishRes.text();
      recordFailure('instagram', classifyError(new Error(err)));
      throw new Error(`Instagram publish failed: ${publishRes.status} ${err}`);
    }

    const result = await publishRes.json() as { id: string };

    logger.info('[instagram-adapter] Published', { mediaId: result.id });

    return {
      platformVideoId: result.id,
      status: 'published',
      url: `https://www.instagram.com/reel/${result.id}`,
    };
    } catch (err) {
      const kind = classifyError(err);
      recordFailure('instagram', kind);
      throw err;
    }
  },

  async checkStatus(
    accessToken: string,
    platformVideoId: string,
  ): Promise<{ status: PublishStatus; error?: string }> {
    const token = accessToken.includes(':') ? accessToken.split(':', 2)[1] : accessToken;

    const res = await fetch(
      `${IG_API}/${platformVideoId}?fields=status_code,timestamp&access_token=${token}`,
    );

    if (!res.ok) return { status: 'failed', error: `Instagram API ${res.status}` };

    const data = await res.json() as { status_code?: string };

    if (data.status_code === 'FINISHED' || !data.status_code) return { status: 'published' };
    if (data.status_code === 'ERROR') return { status: 'failed', error: 'Media processing error' };
    return { status: 'processing' };
  },

  async refreshToken(
    clientId: string,
    _clientSecret: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // Instagram uses long-lived token exchange
    const res = await fetch(
      `${IG_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&fb_exchange_token=${refreshToken}`,
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Instagram token refresh failed: ${res.status} ${err}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  },
};
