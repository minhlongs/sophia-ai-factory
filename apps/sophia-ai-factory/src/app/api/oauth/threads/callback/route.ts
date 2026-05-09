/**
 * GET /api/oauth/threads/callback
 * Exchanges code → short-lived → long-lived (60d) Threads token.
 * Stores encrypted token in publishing_channels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Client } from '@/seed/db/client';
import { encryptToken } from '@/lib/publishing/token-crypto';
import { exchangeCodeForTokens, getUserInfo } from '@/lib/publishing/threads-oauth-client';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

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
  if (!secret) throw new Error('OAUTH_STATE_SECRET not set');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (errorParam) {
    logger.warn('[Threads Callback] OAuth error', { error: errorParam });
    return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?error=oauth_denied`);
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

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    logger.error('[Threads Callback] Token exchange failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  let userInfo;
  try {
    userInfo = await getUserInfo(tokens.access_token);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Threads user info' }, { status: 502 });
  }

  const encryptedAccess = await encryptToken(tokens.access_token);
  const now = Math.floor(Date.now() / 1000);
  // Long-lived token lasts 60 days
  const expiresAt = now + (tokens.expires_in ?? 5184000);

  const db = await getD1Client();
  const tenantId = user.id;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'threads')
    .eq('external_account_id', userInfo.id)
    .single();

  const displayName = userInfo.username ? `@${userInfo.username}` : (userInfo.name ?? userInfo.id);

  if (existing) {
    await db.from('publishing_channels').update({
      access_token: encryptedAccess,
      expires_at: expiresAt,
      status: 'active',
      display_name: displayName,
      updated_at: now,
    }).eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'threads',
      external_account_id: userInfo.id,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: null,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Threads Callback] Account connected', { userId: user.id, threadsUserId: userInfo.id });
  return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?connected=threads`);
}
