/**
 * GET /api/oauth/twitter/connect
 * Generates PKCE pair, embeds code_verifier in HMAC-signed state, redirects to X authorize URL.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { generatePkce, getAuthorizationUrl } from '@/lib/publishing/twitter-oauth-client';
import { logger } from '@/seed/utils/logger-utility';

async function buildSignedState(payload: { userId: string; codeVerifier: string }): Promise<string> {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET is required');
  const body = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString('base64url');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${Buffer.from(sig).toString('base64url')}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.TWITTER_CLIENT_ID || !process.env.NEXT_PUBLIC_APP_URL) {
      return NextResponse.json({ error: 'X OAuth not configured' }, { status: 503 });
    }

    const { codeVerifier, codeChallenge } = await generatePkce();
    const state = await buildSignedState({ userId: user.id, codeVerifier });
    const authUrl = getAuthorizationUrl(state, codeChallenge);

    logger.info('[oauth/twitter/connect] Redirecting to X OAuth', { userId: user.id });
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/twitter/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
