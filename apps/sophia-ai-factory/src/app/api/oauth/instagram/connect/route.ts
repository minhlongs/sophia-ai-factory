/**
 * GET /api/oauth/instagram/connect
 * Redirect to Facebook/Instagram OAuth2 with HMAC-signed state (CSRF protection).
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';

const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';

const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
];

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

    const appId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    if (!appId || !redirectUri) {
      throw new Error('INSTAGRAM_APP_ID and INSTAGRAM_REDIRECT_URI must be configured');
    }

    const state = await buildSignedState(user.id);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: INSTAGRAM_SCOPES.join(','),
      response_type: 'code',
      state,
    });

    logger.info('[oauth/instagram/connect] Redirecting to Facebook OAuth', { userId: user.id });
    return NextResponse.redirect(`${FACEBOOK_AUTH_URL}?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/instagram/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
