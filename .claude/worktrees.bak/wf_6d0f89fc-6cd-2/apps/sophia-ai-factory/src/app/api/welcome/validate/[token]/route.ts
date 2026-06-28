/**
 * GET /api/welcome/validate/[token]
 * Validates magic link token and returns handover data for welcome page.
 * POST: consumes token (marks first login, invalidates token) + creates Better Auth session.
 *
 * @module app/api/welcome/validate/[token]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMagicLinkToken, consumeMagicLink } from '@/tree/handover/handover-magic-link';
import { getD1 } from '@/seed/db/client';
import { getAuth } from '@/seed/auth/better-auth-server';
import { logger } from '@/seed/utils/logger-utility';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { signCookieValue, hashEmail } from '@/seed/auth/sign-cookie-value';
import { checkRateLimit } from '@/forest/middleware/rate-limit-wrapper';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json({ error: 'Invalid or expired magic link' }, { status: 404 });
  }

  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
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
 * Create a Better Auth session for the handover customer user.
 * Returns the session token or null on failure.
 */
async function createSessionForUser(
  userId: string,
  request: NextRequest,
): Promise<{ token: string; expiresAt: Date } | null> {
  try {
    const auth = getAuth();
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

/** Allowed locales — must match next-intl config in middleware.ts */
const ALLOWED_LOCALES = ['en', 'vi'] as const;
type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

function safeLocale(raw: unknown): AllowedLocale {
  if (typeof raw === 'string' && (ALLOWED_LOCALES as readonly string[]).includes(raw)) {
    return raw as AllowedLocale;
  }
  return 'en';
}

/**
 * POST — consume magic link, mint Better Auth session.
 * Rate-limited 10 req/min/IP as defence-in-depth against token brute-force.
 * Token space is 64 hex chars so brute-force is statistically infeasible,
 * but cheap rate limiting blocks scripted abuse.
 *
 * Accepts optional `{ locale }` in request body to build a locale-aware
 * redirectUrl. Defaults to 'en' if absent or invalid. Whitelist-validated —
 * never reflects arbitrary input back as a URL component.
 */
export async function POST(request: NextRequest, ctx: RouteParams): Promise<NextResponse> {
  const rateLimited = checkRateLimit(request, {
    config: { intervalMs: 60_000, maxRequests: 10 },
    addHeaders: true,
  });
  if (rateLimited) return rateLimited;

  const { token } = await ctx.params;

  // Parse optional locale from request body — explicit is safer than header sniffing.
  let requestLocale: AllowedLocale = 'en';
  try {
    const body = await request.json() as Record<string, unknown>;
    requestLocale = safeLocale(body.locale);
  } catch { /* no body or non-JSON — use default */ }

  const handover = await validateMagicLinkToken(token);
  if (!handover) {
    return NextResponse.json(
      { error: 'Link không hợp lệ hoặc đã hết hạn / Invalid or expired magic link' },
      { status: 404 },
    );
  }

  // Consume token first (single-use enforcement) — clears magic_link_token.
  // Pass token in for race-safe single-write: only the first concurrent caller
  // sees changes>0; the loser bails with 410 instead of minting a duplicate session.
  const consumed = await consumeMagicLink(handover.id, token);
  if (!consumed) {
    return NextResponse.json(
      { error: 'Link đã được sử dụng / Magic link already consumed' },
      { status: 410 },
    );
  }

  // Look up customer email for audit log (hashed for PII protection)
  let emailHash: string | null = null;
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const u = await db
      .prepare(`SELECT email FROM user WHERE id = ?1 LIMIT 1`)
      .bind(handover.customer_user_id)
      .first<{ email: string }>();
    if (u?.email) emailHash = await hashEmail(u.email);
  } catch { /* non-fatal */ }

  await writeAuditLog({
    actorUserId: handover.customer_user_id,
    actionType: 'customer_handover_consumed',
    targetUserId: handover.customer_user_id,
    payload: { handoverId: handover.id, emailHash, source: handover.source },
  });

  logger.info('[Welcome/Consume] Magic link consumed', { handoverId: handover.id });

  // Build locale-aware redirect to canonical onboarding URL.
  // /dashboard/onboarding is auth-gated (middleware redirects to /login if no session),
  // so the session cookie MUST be set before the client navigates to this URL.
  // The client uses window.location.href after fetch resolves, so the Set-Cookie
  // header from this response will be stored by the browser before navigation.
  const redirectUrl = `/${requestLocale}/dashboard/onboarding`;

  const response = NextResponse.json({
    success: true,
    redirectUrl,
  });

  const session = await createSessionForUser(handover.customer_user_id, request);
  if (session) {
    const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET=REDACTED || '';
    if (!secret) {
      logger.error('[Welcome/Consume] Missing BETTER_AUTH_SECRET — cannot sign session cookie');
    } else {
      // Must match better-auth-server.ts `useSecureCookies` logic exactly:
      // useSecureCookies = process.env.NODE_ENV !== 'development'
      // On Cloudflare Workers production, NODE_ENV is 'production' → __Secure- prefix.
      const useSecureCookies = process.env.NODE_ENV !== 'development';
      const cookieName = `${useSecureCookies ? '__Secure-' : ''}better-auth.session_token`;
      const signedValue = await signCookieValue(session.token, secret);
      const expires = new Date(session.expiresAt).toUTCString();
      const cookieAttrParts = [
        `${cookieName}=${signedValue}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Expires=${expires}`,
      ];
      // Only add Secure flag when using __Secure- prefix (matches useSecureCookies in better-auth-server.ts)
      if (useSecureCookies) cookieAttrParts.splice(2, 0, 'Secure');
      const cookieAttrs = cookieAttrParts.join('; ');
      response.headers.append('Set-Cookie', cookieAttrs);
      await writeAuditLog({
        actorUserId: handover.customer_user_id,
        actionType: 'customer_handover_session_created',
        targetUserId: handover.customer_user_id,
        payload: { handoverId: handover.id, expiresAt: session.expiresAt },
      });
      logger.info('[Welcome/Consume] Signed session cookie set', {
        handoverId: handover.id,
        userId: handover.customer_user_id,
        cookieName,
        useSecureCookies,
      });
    }
  } else {
    logger.warn('[Welcome/Consume] Session not created — user will be redirected to /login', {
      handoverId: handover.id,
    });
  }

  return response;
}

