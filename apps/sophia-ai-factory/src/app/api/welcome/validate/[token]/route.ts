/**
 * GET /api/welcome/validate/[token]
 * Validates magic link token and returns handover data for welcome page.
 * POST: consumes token (marks first login) + creates Better Auth session.
 *
 * @module app/api/welcome/validate/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLinkToken, consumeMagicLink } from '@/lib/handover/handover-magic-link';
import { getD1Raw } from '@/lib/db/client';
import { getAuth } from '@/lib/better-auth-server';
import { logger } from '@/lib/utils/logger-utility';
import type { CustomerHandoverRow } from '@/lib/handover/handover-types';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json({ error: 'Invalid or expired magic link' }, { status: 404 });
  }

  try {
    const db = await getD1Raw();
    const userRow = await db
      .prepare(`SELECT email, name FROM user WHERE id = ?1 LIMIT 1`)
      .bind(handover.customer_user_id)
      .first<{ email: string; name: string }>();

    const installedSops: string[] = handover.starter_sops
      ? (JSON.parse(handover.starter_sops) as string[])
      : [];

    return NextResponse.json({
      handoverId: handover.id,
      agencyName: handover.agency_name,
      agencyType: handover.agency_type,
      tier: handover.tier,
      ownerEmail: userRow?.email ?? '',
      ownerFullName: userRow?.name ?? '',
      installedSops,
      firstLoginAt: handover.customer_first_login_at,
      firstSopInstallAt: handover.customer_first_sop_install_at,
      firstRunAt: handover.customer_first_run_at,
      status: handover.status,
    });
  } catch (err) {
    logger.error('[Welcome/Validate] DB error', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Sign a cookie value using the same scheme Better Auth/better-call uses:
 * `${value}.${base64(HMAC-SHA256(value, secret))}`, then percent-encoded.
 * This MUST stay in sync with better-call's `signCookieValue` (crypto.mjs)
 * so `auth.api.getSession()` accepts the cookie we issue here.
 */
async function signCookieValue(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return encodeURIComponent(`${value}.${sig}`);
}

/**
 * Create a Better Auth session for the handover customer user.
 * Returns the session token or null on failure.
 */
async function createSessionForUser(
  userId: string,
  request: NextRequest,
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    const auth = getAuth();
    // Better Auth v1.x exposes $context as a promise resolving to the internal auth context.
    // internalAdapter.createSession(userId, request) persists a session row in D1 and
    // returns { id, token, userId, expiresAt, ... }.
    const ctx = await (auth as unknown as { $context: Promise<{
      internalAdapter: {
        createSession: (
          userId: string,
          request: Request,
          dontRememberMe?: boolean,
          cookieAttributes?: Record<string, unknown>,
        ) => Promise<{ token: string; expiresAt: Date } | null>;
      };
    }> }).$context;

    const session = await ctx.internalAdapter.createSession(userId, request);
    return session;
  } catch (err) {
    logger.warn('[Welcome/Consume] Could not create Better Auth session via internalAdapter', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json(
      { error: 'Link không hợp lệ hoặc đã hết hạn / Invalid or expired magic link' },
      { status: 404 },
    );
  }

  // Consume token first (single-use enforcement) — even if session creation fails
  await consumeMagicLink(handover.id);

  logger.info('[Welcome/Consume] Magic link consumed', { handoverId: handover.id });

  const response = NextResponse.json({
    success: true,
    redirectUrl: '/setup-wizard',
  });

  // Create a real Better Auth session and attach it as a SIGNED cookie so the
  // browser is authenticated when the welcome page redirects to /setup-wizard.
  // Cookie value must be signed with BETTER_AUTH_SECRET — `auth.api.getSession()`
  // verifies the HMAC signature and rejects raw tokens.
  const session = await createSessionForUser(handover.customer_user_id, request);
  if (session) {
    const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET=REDACTED || '';
    if (!secret) {
      logger.error('[Welcome/Consume] Missing BETTER_AUTH_SECRET — cannot sign session cookie');
    } else {
      // Better Auth prepends `__Secure-` when the configured baseURL is https
      // (production). Match that exact name or `auth.api.getSession()` won't
      // find the cookie.
      const baseUrl = process.env.BETTER_AUTH_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || 'https://sophia.agencyos.network';
      const isHttps = baseUrl.startsWith('https://');
      const cookieName = `${isHttps ? '__Secure-' : ''}better-auth.session_token`;
      const signedValue = await signCookieValue(session.token, secret);
      const expires = new Date(session.expiresAt).toUTCString();
      const cookieAttrs = [
        `${cookieName}=${signedValue}`,
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        `Expires=${expires}`,
      ].join('; ');
      response.headers.append('Set-Cookie', cookieAttrs);
      logger.info('[Welcome/Consume] Signed session cookie set', {
        handoverId: handover.id,
        userId: handover.customer_user_id,
      });
    }
  } else {
    // Non-fatal: log but still redirect. User may need to log in manually.
    logger.warn('[Welcome/Consume] Session not created — user will be redirected to /login', {
      handoverId: handover.id,
    });
  }

  return response;
}
