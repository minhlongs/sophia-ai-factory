/**
 * GET /api/oauth/instagram/connect
 *
 * Redirect user to Facebook/Instagram OAuth2 authorization page.
 * Uses Facebook Login for Instagram (Graph API requires FB App).
 * After auth, callback handled at /api/oauth/instagram/callback (separate route, future phase).
 *
 * Required env vars:
 *   INSTAGRAM_APP_ID — Facebook App ID
 *   INSTAGRAM_REDIRECT_URI — callback URI registered in FB App
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

function getCredentials(): { appId: string; redirectUri: string } {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !redirectUri) {
    throw new Error('INSTAGRAM_APP_ID and INSTAGRAM_REDIRECT_URI must be configured');
  }
  return { appId, redirectUri };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { appId, redirectUri } = getCredentials();

    // State encodes userId for callback verification (CSRF protection)
    const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64url');

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: INSTAGRAM_SCOPES.join(','),
      response_type: 'code',
      state,
    });

    const authUrl = `${FACEBOOK_AUTH_URL}?${params.toString()}`;
    logger.info('[oauth/instagram/connect] Redirecting to Facebook OAuth', { userId: user.id });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/instagram/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
