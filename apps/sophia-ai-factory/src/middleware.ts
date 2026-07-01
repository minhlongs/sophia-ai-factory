import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateNonce } from '@/forest/raas-service';
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce';
import { verifyCsrfToken, requiresCsrfCheck, csrfForbiddenResponse, CSRF_COOKIE_NAME } from '@/seed/security/csrf';
import { getTracer } from '@/seed/telemetry/opentelemetry-setup';
import { record as recordMetrics } from '@/seed/observability/telemetry/metrics';
import { isInternalOrStatic } from './middleware-helpers';
import { handleCorsPrelight } from './middleware/cors';
import { handleApiPipeline } from './middleware/api-pipeline';
import { handleDashboardPipeline } from './middleware/dashboard-pipeline';
import { handlePublicPipeline } from './middleware/public-pipeline';
import { checkAuthRateLimit } from '@/forest/middleware/rate-limiter';

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
  return NextResponse.redirect(url);
}

async function proxyImpl(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const startTime = Date.now();

  if (isInternalOrStatic(pathname)) return NextResponse.next();

  const pathLocale = pathname.split('/')[1];
  if (pathLocale && !isSupportedLocale(pathLocale)) return redirectToDefault(request);

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
      return NextResponse.redirect(new URL(`/${locale}/login?${p.toString()}`, request.url));
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
  const tracer = getTracer();
  const span = tracer.startSpan('middleware.proxy', {
    attributes: { 'http.method': request.method, 'http.route': request.nextUrl.pathname, component: 'middleware' },
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
    // L2: return a safe error response with security headers instead of throwing
    return applySecurityHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  } finally {
    const duration = Date.now() - startTime;
    span.setAttribute('duration_ms', duration);
    span.setAttribute('http.status_code', status);
    span.end();
    recordMetrics(request.nextUrl.pathname, duration, isError);
  }
}

export const middleware = proxy;

export const config = {
  matcher: ['/((?!_next|_worker|auth/callback|api/version|.*\\..*).*)'],
};
