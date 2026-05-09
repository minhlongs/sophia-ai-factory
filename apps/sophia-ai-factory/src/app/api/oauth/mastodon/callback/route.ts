/**
 * GET /api/oauth/mastodon/callback
 * Resolves opaque state nonce from D1 store (contains instanceUrl + client credentials).
 * Exchanges code for token, fetches account, stores encrypted token.
 * external_account_id stored as "<instanceUrl>|<accountId>" compound key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Client, getD1Raw } from '@/seed/db/client';
import { encryptToken } from '@/lib/publishing/token-crypto';
import { exchangeCodeForTokens, getAccountInfo } from '@/lib/publishing/mastodon-oauth-client';
import { consumeOauthState } from '@/seed/auth/oauth-state-store';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateNonce = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (errorParam) {
    logger.warn('[Mastodon Callback] OAuth error', { error: errorParam });
    return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?error=oauth_denied`);
  }
  if (!code || !stateNonce) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  // Resolve state nonce from server-side store (consumes it — single-use)
  const db = await getD1Raw();
  const statePayload = await consumeOauthState(stateNonce, db);
  if (!statePayload) {
    return NextResponse.json({ error: 'Invalid or expired state' }, { status: 400 });
  }

  const stateData = statePayload as {
    userId: string;
    instanceUrl: string;
    clientId: string;
    clientSecret: string;
  };

  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user || user.id !== stateData.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(stateData.instanceUrl, stateData.clientId, stateData.clientSecret, code);
  } catch (err) {
    logger.error('[Mastodon Callback] Token exchange failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  let account;
  try {
    account = await getAccountInfo(stateData.instanceUrl, tokens.access_token);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Mastodon account info' }, { status: 502 });
  }

  const encryptedAccess = await encryptToken(tokens.access_token);
  const now = Math.floor(Date.now() / 1000);
  // Mastodon tokens don't expire by default — store with synthetic 1-year window
  const expiresAt = now + 365 * 24 * 3600;

  const supaDb = await getD1Client();
  const tenantId = user.id;

  // Compound external account id includes instance for uniqueness across instances
  const externalAccountId = `${stateData.instanceUrl}|${account.id}`;

  const { data: existing } = await supaDb
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'mastodon')
    .eq('external_account_id', externalAccountId)
    .single();

  const displayName = account.display_name
    ? `${account.display_name} (@${account.acct})`
    : `@${account.acct}`;

  if (existing) {
    await supaDb.from('publishing_channels').update({
      access_token: encryptedAccess,
      expires_at: expiresAt,
      status: 'active',
      display_name: displayName,
      updated_at: now,
    }).eq('id', (existing as { id: string }).id);
  } else {
    await supaDb.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'mastodon',
      external_account_id: externalAccountId,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: null,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Mastodon Callback] Account connected', { userId: user.id, instance: stateData.instanceUrl, accountId: account.id });
  return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?connected=mastodon`);
}
