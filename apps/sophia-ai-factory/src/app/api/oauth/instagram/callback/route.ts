/**
 * GET /api/oauth/instagram/callback
 *
 * FB/Instagram OAuth callback. Verifies HMAC-signed state, exchanges code for
 * long-lived token (60 days), stores encrypted in D1 publishing_channels.
 *
 * No refresh_token: FB uses fb_exchange_token re-exchange before expiry.
 */

import { NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { getD1Client } from '@/lib/db/client';
import { encryptToken } from '@/lib/publishing/token-crypto';
import { logger } from '@/lib/utils/logger-utility';
import { randomUUID } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

async function verifyState(state: string): Promise<{ userId: string; ts: number }> {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET is required');

  const parts = state.split('.');
  if (parts.length !== 2) throw new Error('Invalid state format');
  const [payload, sigB64] = parts as [string, string];

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify('HMAC', key, Buffer.from(sigB64, 'base64url'), new TextEncoder().encode(payload));
  if (!valid) throw new Error('State HMAC verification failed');

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId: string; ts: number };
  if (Date.now() - parsed.ts > STATE_MAX_AGE_MS) throw new Error('State token expired');
  return parsed;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    logger.warn('[oauth/instagram/callback] User denied access', { error: errorParam });
    return NextResponse.redirect(new URL('/dashboard/channels?error=denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    const statePayload = await verifyState(state);
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user || user.id !== statePayload.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) {
      throw new Error('Instagram OAuth env vars not configured');
    }

    // Exchange code -> short-lived token
    const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '');
      throw new Error(`Short-lived token exchange failed: HTTP ${tokenRes.status}`);
    }
    const shortToken = (await tokenRes.json()) as { access_token: string };

    // Exchange short-lived -> long-lived (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken.access_token}`,
    );
    if (!longRes.ok) throw new Error(`Long-lived token exchange failed: HTTP ${longRes.status}`);
    const longToken = (await longRes.json()) as { access_token: string; expires_in: number };

    // Fetch IG account info
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,instagram_business_account&access_token=${longToken.access_token}`,
    );
    if (!meRes.ok) throw new Error(`FB /me fetch failed: HTTP ${meRes.status}`);
    const me = (await meRes.json()) as { id: string; name: string; instagram_business_account?: { id: string } };

    const igAccountId = me.instagram_business_account?.id ?? me.id;
    const expiresAt = Math.floor(Date.now() / 1000) + (longToken.expires_in ?? 5184000);
    const encryptedToken = await encryptToken(longToken.access_token);
    const now = Math.floor(Date.now() / 1000);

    const db = await getD1Client();
    await db.from('publishing_channels').upsert({
      id: randomUUID(),
      tenant_id: user.id,
      user_id: user.id,
      provider: 'instagram',
      external_account_id: igAccountId,
      display_name: me.name ?? 'Instagram Account',
      access_token: encryptedToken,
      refresh_token: null,
      expires_at: expiresAt,
      status: 'active',
      refreshing_at: null,
      created_at: now,
      updated_at: now,
    });

    logger.info('[oauth/instagram/callback] Channel connected', { userId: user.id, igAccountId });
    return NextResponse.redirect(new URL('/dashboard/channels?success=instagram', request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/instagram/callback] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: 'OAuth callback failed' }, { status: 500 });
  }
}
