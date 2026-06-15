/**
 * POST /api/oauth/mastodon/connect
 * Body: { instanceUrl: string }
 * Registers app dynamically on instance, then redirects to OAuth authorize URL.
 * Stores instance credentials server-side (D1 + AES-GCM) — only opaque nonce in URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { registerMastodonApp, getAuthorizationUrl } from '@/forest/publishing/mastodon-oauth-client';
import { storeOauthState } from '@/seed/auth/oauth-state-store';
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { isSafeUrl } from '@/seed/utils/is-safe-url';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { instanceUrl?: string };
    try {
      body = (await request.json()) as { instanceUrl?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const instanceUrl = body.instanceUrl?.trim();
    if (!instanceUrl) {
      return NextResponse.json({ error: 'instanceUrl is required' }, { status: 400 });
    }

    // Basic URL validation
    let normalized: string;
    try {
      const parsed = new URL(instanceUrl.startsWith('http') ? instanceUrl : `https://${instanceUrl}`);
      normalized = `${parsed.protocol}//${parsed.host}`;
    } catch {
      return NextResponse.json({ error: 'Invalid instanceUrl' }, { status: 400 });
    }

  // SSRF guard: reject URLs pointing to internal/private endpoints
  if (!isSafeUrl(normalized)) {
    return NextResponse.json({ error: 'Invalid instanceUrl' }, { status: 400 });
  }

    const creds = await registerMastodonApp(normalized);
    const db = await getD1Raw();

    // Store sensitive payload server-side; put only opaque nonce in URL state
    const stateNonce = await storeOauthState(
      'mastodon',
      user.id,
      {
        userId: user.id,
        instanceUrl: normalized,
        clientId: creds.client_id,
        clientSecret: creds.client_secret,
      },
      db,
      600, // 10 min TTL
    );

    const authUrl = getAuthorizationUrl(normalized, creds.client_id, stateNonce);
    logger.info('[oauth/mastodon/connect] Registered app + redirecting', { userId: user.id, instance: normalized });
    return NextResponse.json({ authUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[oauth/mastodon/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
