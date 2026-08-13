/**
 * GET /api/oauth/pinterest/callback
 * Handles Pinterest OAuth callback.
 * Exchanges code → access_token + refresh_token.
 * Stores encrypted tokens in publishing_channels (D1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'pinterest-oauth';

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

interface PinterestTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface PinterestUserResponse {
  id?: string;
  username?: string;
  profile_image?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    logger.warn('[Pinterest Callback] OAuth error', { error: errorParam });
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

  const clientId = process.env.PINTEREST_CLIENT_ID ?? '';
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET ?? '';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/pinterest/callback`;

  // Exchange code → tokens
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let tokenData: PinterestTokenResponse;
  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const kind = classifyHttpStatus(tokenRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Pinterest Callback] Token exchange failed', new Error(`HTTP ${tokenRes.status}`));
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
    }
    tokenData = (await tokenRes.json()) as PinterestTokenResponse;
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

  // Fetch Pinterest user info
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let meData: PinterestUserResponse;
  try {
    const meRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!meRes.ok) {
      const kind = classifyHttpStatus(meRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Pinterest Callback] User info fetch failed', new Error(`HTTP ${meRes.status}`));
      return NextResponse.json({ error: 'Failed to fetch Pinterest account info' }, { status: 502 });
    }
    meData = (await meRes.json()) as PinterestUserResponse;
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
  if (!meData.id) {
    return NextResponse.json({ error: 'Missing Pinterest user ID' }, { status: 502 });
  }

  // Pinterest publishes Pins to a *board*, not the user. Fetch first board so
  // publish-execute can use external_account_id directly as board_id (KISS:
  // multi-board picker UI deferred). Without this step, publish jobs fail 4xx.
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let boardsData: { items?: Array<{ id: string; name: string }> };
  try {
    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=1', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!boardsRes.ok) {
      const kind = classifyHttpStatus(boardsRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Pinterest Callback] Boards fetch failed', new Error(`HTTP ${boardsRes.status}`));
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations/channels?error=pinterest_no_boards`,
      );
    }
    boardsData = (await boardsRes.json()) as { items?: Array<{ id: string; name: string }> };
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
  const firstBoard = boardsData.items?.[0];
  if (!firstBoard) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations/channels?error=pinterest_no_boards`,
    );
  }
  const boardId = firstBoard.id;
  const boardName = firstBoard.name;

  const now = Math.floor(Date.now() / 1000);
  const encryptedAccess = await encryptToken(tokenData.access_token);
  const encryptedRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  // Pinterest access tokens: 1 hour by default, refresh tokens: 365 days
  const expiresAt = now + (tokenData.expires_in ?? 3600);

  const db = createServerClient();
  const tenantId = user.id;

  const displayName = meData.username
    ? `${meData.username} · ${boardName}`
    : `${meData.id} · ${boardName}`;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'pinterest')
    .eq('external_account_id', boardId)
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
      provider: 'pinterest',
      external_account_id: boardId,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Pinterest Callback] Channel connected', { userId: user.id, pinterestUserId: meData.id, boardId });
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=pinterest`);
}
