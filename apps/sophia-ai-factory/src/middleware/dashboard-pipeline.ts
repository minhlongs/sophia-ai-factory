import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { pathnameWithoutLocale } from '../middleware-helpers';
import { requireAuth } from './auth';
import { enforceMfaGate } from './mfa';
import { intlMiddleware, applySecurityHeaders } from './middleware-shared-config';

export async function handleDashboardPipeline(
  request: NextRequest,
  pathLocale: string | undefined,
  requestHeaders: Headers,
  nonce: string,
  needsCsrfSeed: boolean,
): Promise<NextResponse | null> {
  const cleanPath = pathnameWithoutLocale(request.nextUrl.pathname);
  if (!cleanPath.startsWith('/dashboard')) return null;

  // Authentication check
  const authResult = await requireAuth(request, pathLocale ?? 'vi');
  if (authResult instanceof NextResponse) return authResult;
  const { session } = authResult;

  // MFA enforcement
  const mfaResponse = await enforceMfaGate(session.session.id, cleanPath, request);
  if (mfaResponse) return mfaResponse;

  // Admin tier/role gate for /dashboard/admin/*
  if (cleanPath.startsWith('/dashboard/admin') && session.user?.id) {
    try {
      const db = getD1();
      if (!db) {
        logger.error('[Middleware] Database unavailable for admin check');
        return NextResponse.redirect(new URL('/dashboard?error=admin_required', request.url));
      }

      const row = await db
        .prepare(
          `SELECT tier, plan FROM subscriptions
           WHERE user_id = ?1 AND status = 'active'
           ORDER BY created_at DESC LIMIT 1`,
        )
        .bind(session.user.id)
        .first<{ tier: string | null; plan: string | null }>();

      const raw = row?.tier ?? row?.plan ?? null;
      const isMaster = raw === 'MASTER' || raw === 'master';

      const profileRow = await db
        .prepare(`SELECT role FROM user_profiles WHERE user_id = ?1 LIMIT 1`)
        .bind(session.user.id)
        .first<{ role: string | null }>();

      const userRole = profileRow?.role ?? null;
      const isAdminRole = userRole === 'admin';

      if (!isMaster && !isAdminRole) {
        return NextResponse.redirect(new URL('/dashboard?error=admin_required', request.url));
      }
    } catch (tierErr) {
      logger.error('[Middleware] Admin tier check failed', toError(tierErr));
      return NextResponse.redirect(new URL('/dashboard?error=admin_required', request.url));
    }
  }

  // Build dashboard response with intl + CSP
  const dashRes = NextResponse.next({ request: { headers: requestHeaders } });
  const intlRes = intlMiddleware(request);
  const intlDashLoc = intlRes.headers.get('location');

  if (intlDashLoc) {
    const redirectRes = NextResponse.redirect(new URL(intlDashLoc, request.url));
    intlRes.headers.forEach((v, k) => { if (k.toLowerCase() !== 'location') redirectRes.headers.set(k, v); });
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }

  intlRes.headers.forEach((v, k) => dashRes.headers.set(k, v));
  applySecurityHeaders(dashRes, nonce, needsCsrfSeed);
  return dashRes;
}
