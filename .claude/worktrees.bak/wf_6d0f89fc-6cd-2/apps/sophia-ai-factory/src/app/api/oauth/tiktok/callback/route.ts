/**
 * GET /api/oauth/tiktok/callback
 * TikTok OAuth2 callback — exchanges code for tokens and upserts
 * a publishing_channels row with encrypted credentials.
 * Mirrors the Instagram callback flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { exchangeCodeForTokens, getUserInfo } from '@/land/tiktok/tiktok-oauth-client';
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
    logger.warn('[oauth/tiktok/callback] OAuth error', { error: errorParam });
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

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  let userInfo: Awaited<ReturnType<typeof getUserInfo>>;
  try {
    tokens = await exchangeCodeForTokens(code);
    userInfo = await getUserInfo(tokens.access_token);
  } catch (err) {
    logger.error('[oauth/tiktok/callback] Token exchange or user info fetch failed', err instanceof Error ? err : undefined);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations/channels?error=connection_failed`);
  }

  const encryptedAccess = await encryptToken(tokens.access_token);
  const encryptedRefresh = await encryptToken(tokens.refresh_token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + tokens.expires_in;

  const db = createServerClient();
  const tenantId = user.id;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'tiktok')
    .eq('external_account_id', userInfo.open_id)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        display_name: userInfo.display_name,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'tiktok',
      external_account_id: userInfo.open_id,
      display_name: userInfo.display_name,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[oauth/tiktok/callback] Channel connected', { userId: user.id, openId: userInfo.open_id });
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=tiktok`);
}
