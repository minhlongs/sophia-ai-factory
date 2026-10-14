import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { bindInstagramAccount } from './account-binder';
import { verifyState } from './state-verifier';
import {
  exchangeLongLivedToken,
  exchangeShortLivedToken,
  fetchInstagramProfile,
} from './token-client';

export async function handleInstagramOAuthCallback(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    logger.warn('[Instagram Callback] OAuth error', { error: errorParam });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?error=oauth_denied`,
    );
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

  try {
    const shortLivedToken = await exchangeShortLivedToken(code, redirectUri);
    const longLivedToken = await exchangeLongLivedToken(shortLivedToken);
    const meData = await fetchInstagramProfile(longLivedToken.accessToken);

    await bindInstagramAccount(user.id, meData, longLivedToken);

    logger.info('[Instagram Callback] Channel connected', {
      userId: user.id,
      igAccountId: meData.id,
    });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=instagram`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Circuit breaker open')) {
      throw error;
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
