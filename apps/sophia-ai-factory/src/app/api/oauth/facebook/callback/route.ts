/**
 * GET /api/oauth/facebook/callback
 * Exchanges code → short-lived → long-lived (60d) user token,
 * then fetches first managed Page and stores its Page Access Token (never expires).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getD1Client } from '@/seed/db/client';
import { encryptToken } from '@/forest/publishing/token-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const FB_GRAPH = 'https://graph.facebook.com/v21.0';

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

interface FBTokenResponse { access_token?: string; expires_in?: number; error?: { message: string } }
interface FBPage { id: string; name: string; access_token: string }
interface FBAccountsResponse { data?: FBPage[] }

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (errorParam) {
    logger.warn('[Facebook Callback] OAuth error', { error: errorParam });
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

  const appId = process.env.FACEBOOK_APP_ID ?? '';
  const appSecret = process.env.FACEBOOK_APP_SECRET ?? '';
  const redirectUri = `${appUrl}/api/oauth/facebook/callback`;

  // Step 1: code → short-lived user token
  const shortRes = await fetch(`${FB_GRAPH}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appId, client_secret: appSecret, code, redirect_uri: redirectUri }),
  });
  if (!shortRes.ok) {
    logger.error('[Facebook Callback] Short-lived exchange failed', new Error(`HTTP ${shortRes.status}`));
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }
  const shortData = (await shortRes.json()) as FBTokenResponse;
  if (!shortData.access_token) return NextResponse.json({ error: 'No token' }, { status: 502 });

  // Step 2: short-lived → long-lived user token (60d)
  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortData.access_token,
  });
  const longRes = await fetch(`${FB_GRAPH}/oauth/access_token?${longParams.toString()}`);
  if (!longRes.ok) return NextResponse.json({ error: 'Long-lived token exchange failed' }, { status: 502 });
  const longData = (await longRes.json()) as FBTokenResponse;
  if (!longData.access_token) return NextResponse.json({ error: 'No long-lived token' }, { status: 502 });

  // Step 3: GET /me/accounts → pick first managed page
  const pagesRes = await fetch(
    `${FB_GRAPH}/me/accounts?fields=id,name,access_token&access_token=${longData.access_token}`,
  );
  if (!pagesRes.ok) return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 502 });
  const pagesData = (await pagesRes.json()) as FBAccountsResponse;
  const page = pagesData.data?.[0];
  if (!page) {
    return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?error=no_pages`);
  }

  // Page Access Tokens never expire when user is admin — store with expires_at=null.
  const encryptedPageToken = await encryptToken(page.access_token);
  const now = Math.floor(Date.now() / 1000);
  const db = await getD1Client();
  const tenantId = user.id;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'facebook')
    .eq('external_account_id', page.id)
    .single();

  if (existing) {
    await db.from('publishing_channels').update({
      access_token: encryptedPageToken,
      expires_at: null,
      status: 'active',
      display_name: page.name,
      updated_at: now,
    }).eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: user.id,
      provider: 'facebook',
      external_account_id: page.id,
      display_name: page.name,
      access_token: encryptedPageToken,
      refresh_token: null,
      expires_at: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[Facebook Callback] Page connected', { userId: user.id, pageId: page.id });
  return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?connected=facebook`);
}
