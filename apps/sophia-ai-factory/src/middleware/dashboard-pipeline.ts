import { NextRequest, NextResponse } from 'next/server';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { pathnameWithoutLocale } from './helpers';
import { requireAuth } from './auth';
import { enforceMfaGate } from './mfa';
import {
  intlMiddleware,
  applySecurityHeaders,
  mergeIntlResponseHeaders,
  SUPPORTED_LOCALES,
} from './middleware-shared-config';

const SUPPORTED_LOCALE_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

// Dashboard route trees mounted exclusively under `src/app/(app)/dashboard/*`
// (and NOT duplicated under `src/app/[locale]/dashboard/*`). Localized requests
// such as `/en/dashboard/admin/byok-rotation` must run through the full auth +
// MFA + admin gates first, then rewrite to `cleanPath` with `x-next-intl-locale`
// forwarded so `(app)/layout.tsx` renders in the requested locale without 404ing.
const APP_ONLY_DASHBOARD_PREFIXES = [
  '/dashboard/admin/byok-rotation',
  '/dashboard/admin/monitoring',
  '/dashboard/admin/sop-reviews',
  '/dashboard/analytics-roi',
  '/dashboard/analytics/cross-platform',
  '/dashboard/ceo-agent',
  '/dashboard/creative-mutator',
  '/dashboard/ip',
  '/dashboard/live-commerce-growth',
  '/dashboard/provenance',
  '/dashboard/publish/schedule',
  '/dashboard/repurpose',
  '/dashboard/social-publisher',
  '/dashboard/sop-creator',
  '/dashboard/viral-expansion',
] as const;

function isAppOnlyDashboardRoute(cleanPath: string): boolean {
  const normalized = cleanPath.length > 1 ? cleanPath.replace(/\/+$/, '') : cleanPath;
  return APP_ONLY_DASHBOARD_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export async function handleDashboardPipeline(
  request: NextRequest,
  pathLocale: string | undefined,
  requestHeaders: Headers,
  nonce: string,
  needsCsrfSeed: boolean,
): Promise<NextResponse | null> {
  const cleanPath = pathnameWithoutLocale(request.nextUrl.pathname);
  if (!cleanPath.startsWith('/dashboard')) return null;

  // /dashboard/login and /dashboard/signup are auth entry points, not protected
  // dashboard pages. Skip them so handlePublicPipeline's BARE_REDIRECTS can
  // redirect to the correct bare /login and /signup routes.
  if (cleanPath === '/dashboard/login' || cleanPath === '/dashboard/signup') return null;

  // Authentication check — validate pathLocale is a real locale, otherwise fallback to 'vi'
  const locale = (pathLocale && (SUPPORTED_LOCALES as readonly string[]).includes(pathLocale)) ? pathLocale : 'vi';
  const authResult = await requireAuth(request, locale);
  if (authResult instanceof NextResponse) {
    const isDemoPreview =
      cleanPath === '/dashboard/control-deck' ||
      (process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('demo') === '1');
    if (!isDemoPreview) {
      return authResult;
    }
  } else {
    const { session } = authResult;

    // MFA enforcement
    const mfaResponse = await enforceMfaGate(session.session.id, cleanPath, request);
    if (mfaResponse) return mfaResponse;

    // Admin tier/role gate for /dashboard/admin/*
    if (cleanPath.startsWith('/dashboard/admin') && session.user?.id) {
    try {
      const db = await getD1();
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
  }

  // Localized requests targeting `(app)`-only dashboard pages (e.g. `/en/dashboard/admin/byok-rotation`)
  // have no matching `[locale]/dashboard/...` segment and would 404 on `NextResponse.next()`.
  // Rewrite to `cleanPath` while forwarding `x-next-intl-locale` for `(app)/layout.tsx`.
  if (pathLocale && SUPPORTED_LOCALE_SET.has(pathLocale) && isAppOnlyDashboardRoute(cleanPath)) {
    requestHeaders.set('x-next-intl-locale', locale);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = cleanPath;
    const rewriteRes = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
    rewriteRes.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 31536000 });
    applySecurityHeaders(rewriteRes, nonce, needsCsrfSeed);
    return rewriteRes;
  }

  // Build dashboard response with intl + CSP
  const dashRes = NextResponse.next({ request: { headers: requestHeaders } });
  const intlRequest = new NextRequest(request.url, {
    headers: requestHeaders,
    method: request.method,
  });
  const intlRes = intlMiddleware(intlRequest);
  const intlDashLoc = intlRes.headers.get('location');

  if (intlDashLoc) {
    const redirectRes = NextResponse.redirect(new URL(intlDashLoc, request.url));
    mergeIntlResponseHeaders(redirectRes, intlRes, { skipLocation: true });
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }

  mergeIntlResponseHeaders(dashRes, intlRes);
  applySecurityHeaders(dashRes, nonce, needsCsrfSeed);
  return dashRes;
}
