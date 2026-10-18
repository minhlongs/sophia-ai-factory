/**
 * TikTok Status Polling & OAuth Token Refresh Helpers
 * Layer: tree/publishing
 */

import type { PublishStatus } from './platform-adapter';

export const TT_API = 'https://open.tiktokapis.com/v2';
export const TT_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

const TIKTOK_STATUS_MAP: Record<string, PublishStatus> = {
  PROCESSING_UPLOAD: 'uploading',
  PROCESSING_DOWNLOAD: 'processing',
  SEND_TO_USER_INBOX: 'published',
  PUBLISH_COMPLETE: 'published',
  FAILED: 'failed',
};

export async function checkTikTokPublishStatus(
  accessToken: string,
  platformVideoId: string,
): Promise<{ status: PublishStatus; error?: string }> {
  const res = await fetch(`${TT_API}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publish_id: platformVideoId }),
  });

  if (!res.ok) return { status: 'failed', error: `TikTok API ${res.status}` };

  const data = (await res.json()) as {
    data: { status: string; fail_reason?: string };
  };

  return {
    status: TIKTOK_STATUS_MAP[data.data.status] ?? 'processing',
    error: data.data.fail_reason,
  };
}

export async function refreshTikTokAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(TT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok token refresh failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    data: { access_token: string; expires_in: number };
  };
  return { accessToken: data.data.access_token, expiresIn: data.data.expires_in };
}
