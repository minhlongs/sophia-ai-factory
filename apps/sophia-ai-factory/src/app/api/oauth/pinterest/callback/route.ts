/**
 * GET /api/oauth/pinterest/callback
 * Handles Pinterest OAuth callback.
 * Exchanges code → access_token + refresh_token.
 * Stores encrypted tokens in publishing_channels (D1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import {
  verifyState,
  exchangeCodeForTokens,
  fetchPinterestUserProfile,
  fetchPinterestFirstBoard,
  persistPublishingChannel,
} from './core';

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

  const tokenData = await exchangeCodeForTokens(code, redirectUri, clientId, clientSecret);
  if (!tokenData || !tokenData.access_token) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  const meData = await fetchPinterestUserProfile(tokenData.access_token);
  if (!meData || !meData.id) {
    return NextResponse.json({ error: 'Failed to fetch Pinterest account info' }, { status: 502 });
  }

  const firstBoard = await fetchPinterestFirstBoard(tokenData.access_token);
  if (!firstBoard) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations/channels?error=pinterest_no_boards`,
    );
  }

  await persistPublishingChannel(user.id, tokenData, meData, firstBoard.id, firstBoard.name);

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=pinterest`);
}
