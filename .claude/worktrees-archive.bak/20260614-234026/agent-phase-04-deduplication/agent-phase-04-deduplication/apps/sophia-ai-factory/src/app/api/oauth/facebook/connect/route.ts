/**
 * GET /api/oauth/facebook/connect
 * Redirect to Facebook OAuth dialog v21.0 with HMAC-signed state.
 * Scopes request Page admin + Reels publish capability.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

const FB_DIALOG = 'https://www.facebook.com/v21.0/dialog/oauth';
const SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'publish_video'];

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

    const appId = process.env.FACEBOOK_APP_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appId || !appUrl) {
      return NextResponse.json({ error: 'Facebook OAuth not configured' }, { status: 503 });
    }

    const state = await buildSignedState(user.id);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: `${appUrl}/api/oauth/facebook/callback`,
      state,
      scope: SCOPES.join(','),
      response_type: 'code',
    });

    logger.info('[oauth/facebook/connect] Redirecting to Facebook OAuth', { userId: user.id });
    return NextResponse.redirect(`${FB_DIALOG}?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/facebook/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
