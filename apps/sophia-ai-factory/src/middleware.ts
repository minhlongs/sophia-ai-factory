import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { emitUsageEvent } from '@/forest/usage-metering';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { isInternalOrStatic, pathnameWithoutLocale } from './middleware-helpers';
import { handleApiRoute } from './middleware-api-handler';
import { getD1 } from '@/seed/db/client';
import {
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrfToken,
  requiresCsrfCheck,
  csrfForbiddenResponse,
  CSRF_COOKIE_NAME,
  validateCronRequest,
} from '@/seed/security/csrf';
import { buildCSPHeader } from '@/seed/security/content-security-policy-configuration';
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce';
import { generateNonce } from '@/forest/raas-service';
import { getTracer } from '@/seed/telemetry/opentelemetry-setup';
import { record as recordMetrics } from '@/seed/observability/telemetry/metrics';

// Modular middleware components
import { isSensitiveApiRoute } from './middleware/sensitive-routes';
import { requireAuth, type BetterAuthSession } from './middleware/auth';
import { enforceMfaGate } from './middleware/mfa';
import { handleCorsPrelight, applyCorsHeaders } from './middleware/cors';
import { withAuth, isPublicApiRoute } from '@/forest/middleware/auth-guard';
import { getSizeLimit, rejectOversizedRequest } from './middleware/request-size-limit';

const SUPPORTED_LOCALES = ['en', 'vi'] as const;

function isSupportedLocale(segment: string | undefined): boolean {
  return segment !== undefined && SUPPORTED_LOCALES.includes(segment as 'en' | 'vi');
}

const intlMiddleware = createMiddleware({
  locales: SUPPORTED_LOCALES,
  defaultLocale: 'vi',
  localePrefix: 'always',
});

function redirectToDefault(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}

/**
 * Attach the per-request CSP nonce header to a response and forward the nonce
 * to Server Components via the x-csp-nonce request header clone.
 */
function attachCspHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('Content-Security-Policy', buildCSPHeader(nonce));
  response.headers.set(CSP_NONCE_HEADER, nonce);
  response.headers.set('Cache-Control', 'no-store');
}

/**
 * Original middleware implementation — now wrapped with OTel tracing.
 */
async function proxyImpl(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const startTime = Date.now();

  // Short-circuit: internal/static assets
  if (isInternalOrStatic(pathname)) {
    return NextResponse.next();
  }

  // Reject unsupported locale segments (e.g. /zh-CN, /ja, /fr) and redirect to root (/vi)
  const pathLocale = pathname.split('/')[1];
  if (pathLocale && !isSupportedLocale(pathLocale)) {
    return redirectToDefault(request);
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCorsPrelight(origin);
  }

  // Generate CSP nonce for every request
  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);

  // CSRF protection for mutating requests
  if (requiresCsrfCheck(pathname, request.method)) {
    if (!verifyCsrfToken(request)) {
      return csrfForbiddenResponse();
    }
  }

  // Seed CSRF token cookie on safe GET requests if absent
  const needsCsrfSeed =
    request.method === 'GET' &&
    !request.cookies.has(CSRF_COOKIE_NAME);

  // API routes
  if (pathname.startsWith('/api')) {
    // Cron secret validation (cron routes bypass CSRF but require internal secret)
    if (pathname.startsWith('/api/cron')) {
      if (!validateCronRequest(request)) {
        return NextResponse.json(
          { error: 'Cron authentication failed', detail: 'Invalid or missing cron secret' },
          { status: 403 }
        );
      }
    }

  // Request size limit — reject oversized payloads before handler runs
  const sizeLimit = getSizeLimit(pathname);
  const sizeRejected = rejectOversizedRequest(request, sizeLimit);
  if (sizeRejected) return sizeRejected;

    const blocked = await handleApiRoute(request, pathname, startTime);
    if (blocked) return blocked;

    // Auth guard for protected API routes (exclude public: health, webhooks, auth, oauth, etc.)
    if (!isPublicApiRoute(pathname)) {
      const authResponse = await withAuth(request);
      if (authResponse) return authResponse;
    }

    // MFA gate for sensitive API routes (webhooks and public routes are excluded)
    if (isSensitiveApiRoute(pathname)) {
      const authResult = await requireAuth(request, pathLocale ?? 'vi');
      if (authResult instanceof NextResponse) {
        return authResult;
      }
      const { session } = authResult;

      const mfaResponse = await enforceMfaGate(session.session.id, pathname, request);
      if (mfaResponse) return mfaResponse;
    }

    // Build successful API response with usage headers
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    const responseTimeMs = Date.now() - startTime;
    response.headers.set('X-Response-Time-Ms', String(responseTimeMs));

    const receiptHeader = request.headers.get('x-raas-receipt');
    if (receiptHeader) response.headers.set('X-RaaS-Receipt', receiptHeader);

    const quotaRemainingJson = request.headers.get('x-quota-remaining');
    if (quotaRemainingJson) {
      try {
        const remaining = JSON.parse(quotaRemainingJson);
        const resetTimestamp = Math.floor(Date.now() / 1000) + 3600;
        response.headers.set(
          'X-RateLimit-Limit',
          String(remaining.hourlyLimit ?? remaining.dailyLimit ?? remaining.hourlyCredits ?? remaining.dailyCredits)
        );
        response.headers.set(
          'X-RateLimit-Remaining',
          String(remaining.hourlyCredits ?? remaining.dailyCredits)
        );
        response.headers.set('X-RateLimit-Reset', String(resetTimestamp));
      } catch (error) {
        logger.error('[Proxy] Failed to parse quota remaining', toError(error));
      }
    }

    const raasTier = request.headers.get('x-raas-tier');
    emitUsageEvent(request, { status: response.status, headers: response.headers }, { tier: raasTier || 'BASIC' }).catch(err => {
      logger.error('[Proxy] Failed to emit success usage event', err);
    });

    attachCspHeaders(response, nonce);
    if (needsCsrfSeed) setCsrfCookie(response, generateCsrfToken());
    return response;
  }

  // Protected page routes (dashboard)
  const cleanPath = pathnameWithoutLocale(pathname);

  if (cleanPath.startsWith('/dashboard')) {
    // Authentication check
    const authResult = await requireAuth(request, pathLocale ?? 'vi');
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { session } = authResult;

    // MFA enforcement (allowlist for challenge page prevents lockout)
    const mfaResponse = await enforceMfaGate(session.session.id, cleanPath, request);
    if (mfaResponse) return mfaResponse;

    // Admin tier/role gate for /dashboard/admin/* (prevents layout flash)
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
             ORDER BY created_at DESC LIMIT 1`
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
      intlRes.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'location') redirectRes.headers.set(key, value);
      });
      attachCspHeaders(redirectRes, nonce);
      if (needsCsrfSeed) setCsrfCookie(redirectRes, generateCsrfToken());
      return redirectRes;
    }

    intlRes.headers.forEach((value, key) => {
      dashRes.headers.set(key, value);
    });
    attachCspHeaders(dashRes, nonce);
    if (needsCsrfSeed) setCsrfCookie(dashRes, generateCsrfToken());
    return dashRes;
  }

  // Auth callback routes (OAuth, etc.) bypass all checks
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // All other routes are public pages with intl + CSP
  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  const intlFinalRes = intlMiddleware(request);
  const intlLocation = intlFinalRes.headers.get('location');

  if (intlLocation) {
    const redirectRes = applyCorsHeaders(NextResponse.redirect(new URL(intlLocation, request.url)), origin);
    intlFinalRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'location') redirectRes.headers.set(key, value);
    });
    attachCspHeaders(redirectRes, nonce);
    if (needsCsrfSeed) setCsrfCookie(redirectRes, generateCsrfToken());
    return redirectRes;
  }

  ;(intlFinalRes as NextResponse).headers.forEach((value, key) => {
    finalResponse.headers.set(key, value);
  });
  attachCspHeaders(finalResponse, nonce);
  if (needsCsrfSeed) setCsrfCookie(finalResponse, generateCsrfToken());
  return finalResponse;
}

/**
 * OTel-instrumented middleware wrapper
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const tracer = getTracer();
  const span = tracer.startSpan('middleware.proxy', {
    attributes: {
      'http.method': request.method,
      'http.route': request.nextUrl.pathname,
      'component': 'middleware',
    },
  });

  let isError = false;
  let status = 200;

  try {
    const response = await proxyImpl(request);
    status = response.status;
    isError = status >= 400;
    return response;
  } catch (err) {
    isError = true;
    const error = err instanceof Error ? err : new Error(String(err));
    span.recordException(error);
    span.setStatus({ code: 1, message: error.message });
    throw err;
  } finally {
    const duration = Date.now() - startTime;
    span.setAttribute('duration_ms', duration);
    span.setAttribute('http.status_code', status);
    span.end();

    // Record metrics (in-memory ring buffer) for all requests
    const route = request.nextUrl.pathname;
    recordMetrics(route, duration, isError);
  }
}

export const middleware = proxy;

/**
 * Matcher: apply middleware to all routes except:
 * - _next (Next.js internals)
 * - _worker (edge functions)
 * - auth/callback (handled separately)
 * - api/version (health endpoint)
 * - static files (.*\..*)
 */
export const config = {
  matcher: ['/((?!_next|_worker|auth/callback|api/version|api/.*|.*\\..*).*)'],
};
