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
      .prepare(`SELECT email, name FROM users WHERE id = ?1 LIMIT 1`)
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

  // Create a real Better Auth session and attach it as a cookie so the
  // browser is authenticated when the welcome page redirects to /setup-wizard.
  const session = await createSessionForUser(handover.customer_user_id, request);
  if (session) {
    // Better Auth session cookie name matches the configured basePath prefix.
    // Default: "better-auth.session_token" with httpOnly + secure + sameSite=lax.
    const cookieName = 'better-auth.session_token';
    response.cookies.set(cookieName, session.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      expires: new Date(session.expiresAt),
      path: '/',
    });
    logger.info('[Welcome/Consume] Session cookie set', {
      handoverId: handover.id,
      userId: handover.customer_user_id,
    });
  } else {
    // Non-fatal: log but still redirect. User may need to log in manually.
    logger.warn('[Welcome/Consume] Session not created — user will be redirected to /login', {
      handoverId: handover.id,
    });
  }

  return response;
}
