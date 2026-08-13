/**
 * GET /api/oauth/instagram/callback
 * Handles Instagram OAuth callback.
 * Exchanges code → short-lived → long-lived (60-day) Facebook token.
 * Stores encrypted access_token in publishing_channels (D1).
 * No refresh_token stored — Instagram uses re-exchange via fb_exchange_token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'instagram-oauth';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getOAuthStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('[Instagram Callback] OAUTH_STATE_SECRET is not set');
  return secret;
}

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return atob(pad ? padded + '='.repeat(4 - pad) : padded);
}

async function verifyState(state: string): Promise<{ userId: string }> {
  const dotIdx = state.lastIndexOf('.');
  if (dotIdx === -1) throw new Error('Invalid state format');

  const payload = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);

  const secret = getOAuthStateSecret();
  const keyBytes = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  if (!valid) throw new Error('State signature invalid');

  const { userId, ts } = JSON.parse(decodeBase64Url(payload)) as { userId: string; ts: number };
  if (Date.now() - ts > STATE_MAX_AGE_MS) throw new Error('State expired');

  return { userId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    logger.warn('[Instagram Callback] OAuth error', { error: errorParam });
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?error=oauth_denied`);
  }

  if (!code || !stateParam) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  let stateData: { userId: string };
  try {
    stateData = await verifyState(stateParam);
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 });
  }

  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user || user.id !== stateData.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/instagram/callback`;

  // Exchange code → short-lived token
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let tokenData: { access_token?: string; error?: { message: string } };
  try {
    const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID ?? '',
        client_secret: process.env.INSTAGRAM_APP_SECRET ?? '',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const kind = classifyHttpStatus(tokenRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Instagram Callback] Short-lived token exchange failed', new Error(`HTTP ${tokenRes.status}`));
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
    }
    tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'No access token returned' }, { status: 502 });
  }

  // Exchange short-lived → long-lived (60-day)
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let longLivedData: { access_token?: string; expires_in?: number };
  try {
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.INSTAGRAM_APP_ID ?? '',
      client_secret: process.env.INSTAGRAM_APP_SECRET ?? '',
      fb_exchange_token: tokenData.access_token,
    });
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${longLivedParams.toString()}`,
    );
    if (!longLivedRes.ok) {
      const kind = classifyHttpStatus(longLivedRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Instagram Callback] Long-lived token exchange failed', new Error(`HTTP ${longLivedRes.status}`));
      return NextResponse.json({ error: 'Long-lived token exchange failed' }, { status: 502 });
    }
    longLivedData = (await longLivedRes.json()) as { access_token?: string; expires_in?: number };
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
  if (!longLivedData.access_token) {
    return NextResponse.json({ error: 'No long-lived token returned' }, { status: 502 });
  }

  // Fetch IG account info
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let meData: { id?: string; name?: string };
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${longLivedData.access_token}`,
    );
    if (!meRes.ok) {
      const kind = classifyHttpStatus(meRes.status);
      recordFailure(SERVICE_NAME, kind);
    }
    meData = (await meRes.json()) as { id?: string; name?: string };
    if (!meRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch Instagram account info' }, { status: 502 });
    }
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
  if (!meData.id) {
    return NextResponse.json({ error: 'Failed to fetch Instagram account info' }, { status: 502 });
  }

  const encryptedToken = await encryptToken(longLivedData.access_token);
  const now = Math.floor(Date.now() / 1000);
  // Long-lived token expires in ~60 days
  const expiresAt = now + (longLivedData.expires_in ?? 60 * 24 * 3600);

  const db = createServerClient();
  const tenantId = user.id; // Adjust if tenantId differs from userId in your model

  // Upsert channel
  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'instagram')
    .eq('external_account_id', meData.id)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedToken,
        expires_at: expiresAt,
        status: 'active',
        display_name: meData.name ?? meData.id,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'instagram',
      external_account_id: meData.id,
      display_name: meData.name ?? meData.id,
      access_token: encryptedToken,
      refresh_token: null, // No refresh_token for Instagram
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Instagram Callback] Channel connected', { userId: user.id, igAccountId: meData.id });
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=instagram`);
}
