/**
 * GET /api/oauth/linkedin
 * Redirect to LinkedIn OAuth2 with HMAC-signed state (CSRF protection).
 * Scopes: w_member_social, r_liteprofile
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';

const LINKEDIN_SCOPES = [
  'w_member_social',
  'r_liteprofile',
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

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new Error('LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI must be configured');
    }

    const state = await buildSignedState(user.id);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: LINKEDIN_SCOPES.join(' '),
      state,
    });

    logger.info('[oauth/linkedin] Redirecting to LinkedIn OAuth', { userId: user.id });
    return NextResponse.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/linkedin] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
