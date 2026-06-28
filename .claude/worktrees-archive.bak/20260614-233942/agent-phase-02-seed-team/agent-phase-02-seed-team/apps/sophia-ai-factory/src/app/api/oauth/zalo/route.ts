/**
 * GET /api/oauth/zalo
 * Redirect to Zalo OA OAuth2 with HMAC-signed state (CSRF protection).
 *
 * PREREQUISITE: Zalo Official Account must be verified at https://oa.zalo.me/manage/oa
 * before this OAuth flow will work.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

const ZALO_AUTH_URL = 'https://oauth.zaloapp.com/v4/oa/permission';

async function buildSignedState(userId: string): Promise<string> {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET is required');
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(sig).toString('base64url')}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const appId = process.env.ZALO_APP_ID;
    const redirectUri = process.env.ZALO_REDIRECT_URI;
    if (!appId || !redirectUri) {
      throw new Error(
        'ZALO_APP_ID and ZALO_REDIRECT_URI must be configured. ' +
          'Complete OA verification at https://oa.zalo.me/manage/oa first.',
      );
    }

    const state = await buildSignedState(user.id);
    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      state,
    });

    logger.info('[oauth/zalo] Redirecting to Zalo OA OAuth', { userId: user.id });
    return NextResponse.redirect(`${ZALO_AUTH_URL}?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/zalo] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
