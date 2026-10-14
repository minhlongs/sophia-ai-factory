import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import type { LinkedInTokenResponse, LinkedInProfileResponse } from './types';
import { verifyState, exchangeLinkedInCode, fetchLinkedInProfile } from './token-client';
import { bindLinkedInChannel } from './account-binder';

export async function handleLinkedInCallback(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    logger.warn('[LinkedIn Callback] OAuth error', { error: errorParam });
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

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/linkedin/callback`;
  let tokenData: LinkedInTokenResponse;
  try {
    tokenData = await exchangeLinkedInCode(code, redirectUri);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'No access token returned' }, { status: 502 });
  }

  let profile: LinkedInProfileResponse;
  try {
    profile = await fetchLinkedInProfile(tokenData.access_token);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    return NextResponse.json({ error: 'Failed to fetch LinkedIn profile' }, { status: 502 });
  }

  if (!profile.id) {
    return NextResponse.json({ error: 'Missing LinkedIn profile ID' }, { status: 502 });
  }

  await bindLinkedInChannel(user.id, tokenData, profile);

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=linkedin`);
}
