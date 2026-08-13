/**
 * GET /api/oauth/linkedin/callback
 * Handles LinkedIn OAuth callback.
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

const SERVICE_NAME = 'linkedin-oauth';

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

interface LinkedInTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

interface LinkedInProfileResponse {
  id?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
}

export async function GET(request: NextRequest) {
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

  // Exchange code → tokens
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let tokenData: LinkedInTokenResponse;
  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
      }),
    });
    if (!tokenRes.ok) {
      const kind = classifyHttpStatus(tokenRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[LinkedIn Callback] Token exchange failed', new Error(`HTTP ${tokenRes.status}`));
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 });
    }
    tokenData = (await tokenRes.json()) as LinkedInTokenResponse;
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

  // Fetch LinkedIn profile info
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let profile: LinkedInProfileResponse;
  try {
    const profileRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (!profileRes.ok) {
      const kind = classifyHttpStatus(profileRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[LinkedIn Callback] Profile fetch failed', new Error(`HTTP ${profileRes.status}`));
      return NextResponse.json({ error: 'Failed to fetch LinkedIn profile' }, { status: 502 });
    }
    profile = (await profileRes.json()) as LinkedInProfileResponse;
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
  if (!profile.id) {
    return NextResponse.json({ error: 'Missing LinkedIn profile ID' }, { status: 502 });
  }

  const now = Math.floor(Date.now() / 1000);
  const encryptedAccess = await encryptToken(tokenData.access_token);
  const encryptedRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  // LinkedIn access tokens: 60 days by default
  const expiresAt = now + (tokenData.expires_in ?? 60 * 24 * 3600);

  const displayName =
    [profile.localizedFirstName, profile.localizedLastName].filter(Boolean).join(' ') || profile.id;

  const db = createServerClient();
  const tenantId = user.id;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'linkedin')
    .eq('external_account_id', profile.id)
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
      provider: 'linkedin',
      external_account_id: profile.id,
      display_name: displayName,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      expires_at: expiresAt,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  logger.info('[LinkedIn Callback] Channel connected', { userId: user.id, linkedInId: profile.id });
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/channels?connected=linkedin`);
}
