/**
 * GET /api/oauth/facebook/callback
 * Exchanges code → short-lived → long-lived (60d) user token,
 * then fetches first managed Page and stores its Page Access Token (never expires).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  FB_GRAPH,
  verifyState,
  upsertFacebookPublishingChannel,
  type FBTokenResponse,
  type FBAccountsResponse,
} from './facebook-callback-helpers';

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
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!shortRes.ok) {
    logger.error(
      '[Facebook Callback] Short-lived exchange failed',
      new Error(`HTTP ${shortRes.status}`),
    );
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
  if (!longRes.ok) {
    return NextResponse.json({ error: 'Long-lived token exchange failed' }, { status: 502 });
  }
  const longData = (await longRes.json()) as FBTokenResponse;
  if (!longData.access_token) {
    return NextResponse.json({ error: 'No long-lived token' }, { status: 502 });
  }

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

  await upsertFacebookPublishingChannel(user.id, page);

  logger.info('[Facebook Callback] Page connected', { userId: user.id, pageId: page.id });
  return NextResponse.redirect(`${appUrl}/dashboard/integrations/channels?connected=facebook`);
}
