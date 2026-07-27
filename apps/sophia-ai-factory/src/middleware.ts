import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateNonce } from '@/forest/raas-service';
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce';
import { verifyCsrfToken, requiresCsrfCheck, csrfForbiddenResponse, CSRF_COOKIE_NAME } from '@/seed/security/csrf';
import { record as recordMetrics } from '@/seed/observability/telemetry/metrics';
import { isInternalOrStatic } from '@/seed/utils/middleware-helpers';
import { createLogger } from '@/seed/utils/logger-utility';
import { handleCorsPrelight } from '@/seed/security/cors';
import { handleApiPipeline } from '@/forest/middleware/api-pipeline';
import { handleDashboardPipeline } from '@/forest/middleware/dashboard-pipeline';
import { handlePublicPipeline } from '@/forest/middleware/public-pipeline';
import { checkAuthRateLimit } from '@/forest/middleware/rate-limiter';

const middlewareLogger = createLogger('middleware');

/** L2: apply security headers to error responses that bypass the normal pipeline */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

const SUPPORTED_LOCALES = ['en', 'vi'] as const;

function isSupportedLocale(segment: string | undefined): boolean {
  return segment !== undefined && SUPPORTED_LOCALES.includes(segment as 'en' | 'vi');
}

function redirectToDefault(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url.toString());
}

async function proxyImpl(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const startTime = Date.now();

  if (isInternalOrStatic(pathname)) return NextResponse.next();

  const pathLocale = pathname.split('/')[1];

  // API routes bypass locale redirect — dispatched through handleApiPipeline below
  if (!pathname.startsWith('/api/')) {
    if (pathLocale && !isSupportedLocale(pathLocale)) return redirectToDefault(request);
  }

  // /guides → /guide redirect (locale-prefixed paths — next.config redirects don't match on CF Workers)
  if (pathLocale && isSupportedLocale(pathLocale) && pathname === `/${pathLocale}/guides`) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pathLocale}/guide`;
    return NextResponse.redirect(url.toString(), 308);
  }

  // ?tab=signup redirect — runs before ISR cache
  const { searchParams: sp } = request.nextUrl;
  if (sp.get('tab') === 'signup') {
    const isHomepage = pathname === '/' || (isSupportedLocale(pathLocale) && pathname === `/${pathLocale}`);
    if (isHomepage) {
      const locale = isSupportedLocale(pathLocale) ? pathLocale! : 'vi';
      const p = new URLSearchParams({ tab: 'signup' });
      for (const k of ['coupon', 'tier', 'redirect'] as const) {
        const v = sp.get(k);
        if (v) p.set(k, v);
      }
      return NextResponse.redirect(new URL(`/${locale}/login?${p.toString()}`, request.url).toString());
    }
  }

  if (request.method === 'OPTIONS') return handleCorsPrelight(origin);

  // Security: D1-backed auth rate limiting (cross-isolate) before pipeline dispatch
  const authRateLimitResponse = await checkAuthRateLimit(request);
  if (authRateLimitResponse) return authRateLimitResponse;

  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  if (requiresCsrfCheck(pathname, request.method) && !verifyCsrfToken(request)) {
    return csrfForbiddenResponse();
  }
  const needsCsrfSeed = request.method === 'GET' && !request.cookies.has(CSRF_COOKIE_NAME);

  // Route to pipeline handlers — each returns null if the path is outside its scope
  const apiRes = await handleApiPipeline(request, pathname, pathLocale, startTime, requestHeaders, nonce, needsCsrfSeed);
  if (apiRes) return apiRes;

  const dashRes = await handleDashboardPipeline(request, pathLocale, requestHeaders, nonce, needsCsrfSeed);
  if (dashRes) return dashRes;

  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return handlePublicPipeline(request, origin, requestHeaders, nonce, needsCsrfSeed);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let isError = false;
  let status = 200;
  try {
    middlewareLogger.debug('proxy called');
    const response = await proxyImpl(request);
    const responseStatus = Number(response.status);
    status = Number.isFinite(responseStatus) ? responseStatus : 500;
    isError = status >= 400;
    middlewareLogger.debug(`proxyImpl returned ${status}`);
    return response;
  } catch (err) {
    isError = true;
  middlewareLogger.error(
    'Unhandled middleware error',
    {
      errName: String(err?.constructor?.name),
      errMsg: (err as Error)?.message,
      pathname: request.nextUrl.pathname,
    },
    '[MIDDLEWARE_ERROR]'
  );
  const errorResponse = applySecurityHeaders(
    NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  );
  middlewareLogger.debug(`proxy error response ${errorResponse.status}`);
  return errorResponse;
  } finally {
    const duration = Date.now() - startTime;
    try { recordMetrics(request.nextUrl.pathname, duration, isError); } catch {}
  }
}

export const middleware = proxy;

/**
 * Matcher: apply middleware to all routes except Next.js internals and static files.
 *
 * API routes (/api/*) GO THROUGH middleware for centralized security:
 *   - CORS preflight handling
 *   - D1-backed auth rate limiting
 *   - CSRF token verification (state-changing methods)
 *   - MFA enforcement, auth guard, size limits (via handleApiPipeline)
 *
 * The locale redirect is skipped for /api/* paths (see proxyImpl guard),
 * so API routes are dispatched to handleApiPipeline instead of being
 * 307-redirected to '/'.
 *
 * Excluded paths:
 *   - _next (Next.js internals)
 *   - _worker (edge functions)
 *   - auth/callback (handled separately in proxyImpl)
 *   - api/version (health endpoint, public — no auth required)
 *   - static files (.*\\..*)
 */
export const config = {
  matcher: ['/((?!_next|_worker|auth/callback|api/version|api/lottery/.*|.*\\..*).*)'],
};
