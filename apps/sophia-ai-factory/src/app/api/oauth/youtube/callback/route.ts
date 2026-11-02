/**
 * GET /api/oauth/youtube/callback
 * YouTube / Google OAuth2 callback — exchanges code for tokens and upserts
 * a publishing_channels row with encrypted credentials.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
import { createServerClient, getD1 } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { exchangeCodeForTokens, getChannelInfo } from '@/land/youtube/youtube-oauth-client';
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

async function resolveOauthTenantId(
  userId: string,
  db: ReturnType<typeof createServerClient>,
): Promise<
  | { ok: true; tenantId: string }
  | { ok: false; errorCode: 'workspace_forbidden' | 'workspace_resolution_failed' }
> {
  try {
    const orgId = await resolveOrgId(userId, db);
    if (!orgId) return { ok: true, tenantId: userId };
    const d1 = await getD1();
    const isAdmin = d1 ? await hasWorkspaceRole(orgId, userId, 'ADMIN', d1) : false;
    if (!isAdmin) {
      logger.warn('[oauth/youtube/callback] Non-admin workspace member blocked', { userId, orgId });
      return { ok: false, errorCode: 'workspace_forbidden' };
    }
    return { ok: true, tenantId: orgId };
  } catch (err) {
    logger.error('[oauth/youtube/callback] Workspace resolution failed', err instanceof Error ? err : undefined);
    return { ok: false, errorCode: 'workspace_resolution_failed' };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (errorParam) {
    logger.warn('[oauth/youtube/callback] OAuth error', { error: errorParam });
    return NextResponse.redirect(`${appOrigin}/dashboard/niche-studio?error=oauth_denied`);
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

  const db = createServerClient();
  const resolved = await resolveOauthTenantId(user.id, db);
  if (!resolved.ok) {
    return NextResponse.redirect(`${appOrigin}/dashboard/niche-studio?error=${resolved.errorCode}`);
  }
  const { tenantId } = resolved;

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
  let channelInfo: Awaited<ReturnType<typeof getChannelInfo>>;
  try {
    tokens = await exchangeCodeForTokens(code);
    channelInfo = await getChannelInfo(tokens.access_token);
  } catch (err) {
    logger.error('[oauth/youtube/callback] Token exchange or channel info fetch failed', err instanceof Error ? err : undefined);
    return NextResponse.redirect(`${appOrigin}/dashboard/niche-studio?error=connection_failed`);
  }

  const encryptedAccess = await encryptToken(tokens.access_token);
  const encryptedRefresh = await encryptToken(tokens.refresh_token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + tokens.expires_in;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'youtube')
    .eq('external_account_id', channelInfo.channelId)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        display_name: channelInfo.title,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'youtube',
      external_account_id: channelInfo.channelId,
      display_name: channelInfo.title,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[oauth/youtube/callback] Channel connected', { userId: user.id, tenantId, channelId: channelInfo.channelId });
  return NextResponse.redirect(`${appOrigin}/dashboard/niche-studio?connected=youtube`);
}
