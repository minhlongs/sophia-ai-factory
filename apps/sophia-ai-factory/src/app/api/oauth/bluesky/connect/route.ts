/**
 * POST /api/oauth/bluesky/connect
 * App-password flow (no OAuth redirect).
 * Body: { handle: string; appPassword: string }
 * Calls com.atproto.server.createSession → store accessJwt + refreshJwt encrypted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { createAtprotoSession } from '@/forest/publishing/bluesky';
import { logger } from '@/seed/utils/logger-utility';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: { handle?: string; appPassword?: string };
    try {
      body = (await request.json()) as { handle?: string; appPassword?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { handle, appPassword } = body;
    if (!handle || !appPassword) {
      return NextResponse.json({ error: 'handle and appPassword are required' }, { status: 400 });
    }

    let session;
    try {
      session = await createAtprotoSession(handle, appPassword);
    } catch (err) {
      logger.error('[bluesky/connect] Session creation failed', err instanceof Error ? err : undefined);
      return NextResponse.json({ error: 'Bluesky authentication failed — check handle and app-password' }, { status: 401 });
    }

    const encryptedAccess = await encryptToken(session.accessJwt);
    const encryptedRefresh = session.refreshJwt ? await encryptToken(session.refreshJwt) : null;
    const now = Math.floor(Date.now() / 1000);
    // AT Protocol access JWTs expire in ~2h; refresh JWTs last ~90d
    const expiresAt = now + 7200;

    const db = createServerClient();
    const tenantId = user.id;

    const { data: existing } = await db
      .from('publishing_channels')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('provider', 'bluesky')
      .eq('external_account_id', session.did)
      .single();

    const displayName = `@${session.handle}`;

    if (existing) {
      await db.from('publishing_channels').update({
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        display_name: displayName,
        updated_at: now,
      }).eq('id', (existing as { id: string }).id);
    } else {
      await db.from('publishing_channels').insert({
        id: randomUUID(),
        tenant_id: tenantId,
        user_id: user.id,
        provider: 'bluesky',
        external_account_id: session.did,
        display_name: displayName,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        expires_at: expiresAt,
        status: 'active',
        created_at: now,
        updated_at: now,
      });
    }

    logger.info('[bluesky/connect] Account connected', { userId: user.id, did: session.did });
    return NextResponse.json({ connected: true, handle: session.handle, did: session.did });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('[bluesky/connect] Error', err instanceof Error ? err : new Error(message));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
