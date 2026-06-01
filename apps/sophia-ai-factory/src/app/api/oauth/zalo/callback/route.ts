/**
 * GET /api/oauth/zalo/callback
 * Handles Zalo OA OAuth callback.
 * Exchanges code → access_token + refresh_token via Zalo OA API v3.
 * Stores encrypted tokens in publishing_channels (D1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Client } from '@/seed/db/client';
import { encryptToken } from '@/forest/publishing/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

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

  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET is not set');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  if (!valid) throw new Error('State signature invalid');

  const { userId, ts } = JSON.parse(decodeBase64Url(payload)) as { userId: string; ts: number };
  if (Date.now() - ts > STATE_MAX_AGE_MS) throw new Error('State expired');

  return { userId };
}

interface ZaloTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: number;
  message?: string;
}

interface ZaloOAInfoResponse {
  error: number;
  message: string;
  data?: { oa_id?: string; name?: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const oaId = searchParams.get('oa_id');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    logger.warn('[Zalo Callback] OAuth error', { error: errorParam });
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

  const appId = process.env.ZALO_APP_ID ?? '';
  const appSecret = process.env.ZALO_APP_SECRET ?? '';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/zalo/callback`;

  // Exchange code → tokens
  const tokenRes = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: appSecret,
    },
    body: new URLSearchParams({
      app_id: appId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    logger.error('[Zalo Callback] Token exchange failed', new Error(`HTTP ${tokenRes.status}`));
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  const tokenData = (await tokenRes.json()) as ZaloTokenResponse;
  if (tokenData.error && tokenData.error !== 0) {
    logger.error('[Zalo Callback] Token error', new Error(`Zalo error ${tokenData.error}: ${tokenData.message}`));
    return NextResponse.json({ error: tokenData.message ?? 'Token error' }, { status: 502 });
  }

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'No access token returned' }, { status: 502 });
  }

  // Fetch OA info
  const oaRes = await fetch('https://openapi.zalo.me/v3/oa/getoa', {
    headers: { access_token: tokenData.access_token },
  });

  const oaInfo = (await oaRes.json()) as ZaloOAInfoResponse;
  const resolvedOaId = oaInfo.data?.oa_id ?? oaId ?? 'unknown';
  const displayName = oaInfo.data?.name ?? resolvedOaId;

  const now = Math.floor(Date.now() / 1000);
  const encryptedAccess = await encryptToken(tokenData.access_token);
  const encryptedRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  // Zalo OA access tokens: 1 hour; refresh tokens: 30 days
  const expiresAt = now + (tokenData.expires_in ?? 3600);

  const db = await getD1Client();
  const tenantId = user.id;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'zalo')
    .eq('external_account_id', resolvedOaId)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        display_name: displayName,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'zalo',
      external_account_id: resolvedOaId,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Zalo Callback] Channel connected', { userId: user.id, oaId: resolvedOaId });
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=zalo`);
}
