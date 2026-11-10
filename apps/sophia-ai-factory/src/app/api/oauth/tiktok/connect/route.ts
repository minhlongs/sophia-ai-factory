/**
 * GET /api/oauth/tiktok/connect
 * Redirect to TikTok OAuth2 with HMAC-signed state (CSRF protection).
 * Mirrors the Instagram connect flow pattern.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { getAuthorizationUrl } from '@/land/tiktok/tiktok-oauth-client';
import { logger } from '@/seed/utils/logger-utility';

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

    const gate = await enforceCommercialFeatureForUser(user.id, 'managed_social_oauth_relay');
    if (!gate.ok) {
      return NextResponse.json(
        { error: 'FEATURE_LOCKED', message: gate.error.message },
        { status: 403 },
      );
    }

    const state = await buildSignedState(user.id);
    const authUrl = getAuthorizationUrl(state);

    logger.info('[oauth/tiktok/connect] Redirecting to TikTok OAuth', { userId: user.id });
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/tiktok/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: 'Failed to initiate TikTok OAuth' }, { status: 500 });
  }
}
