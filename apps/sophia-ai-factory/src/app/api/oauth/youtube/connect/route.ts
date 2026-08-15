/**
 * GET /api/oauth/youtube/connect
 * Redirect to Google OAuth2 with HMAC-signed state (CSRF protection).
 * Mirrors the Instagram connect flow pattern.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getAuthorizationUrl } from '@/land/youtube/youtube-oauth-client';
import { logger } from '@/seed/utils/logger-utility';
import { handleThrownError } from '@/seed/api';

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

    const state = await buildSignedState(user.id);
    const authUrl = getAuthorizationUrl(state);

    logger.info('[oauth/youtube/connect] Redirecting to Google OAuth', { userId: user.id });
    return NextResponse.redirect(authUrl);
  } catch (err) {
    return handleThrownError(err, 'Failed to initiate OAuth', 'OAUTH_CONNECT_FAILED');
  }
}
