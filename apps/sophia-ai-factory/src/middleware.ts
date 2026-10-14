import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateNonce } from '@/seed/security/nonce-utils';
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce';
import { verifyCsrfToken, requiresCsrfCheck, csrfForbiddenResponse, CSRF_COOKIE_NAME } from '@/seed/security/csrf';
import { record as recordMetrics } from '@/seed/observability/telemetry/metrics';
import { isInternalOrStatic } from './middleware/helpers';
import { handleCorsPrelight } from './middleware/cors';
import { handleApiPipeline } from './middleware/api-pipeline';
import { handleDashboardPipeline } from './middleware/dashboard-pipeline';
import { handlePublicPipeline } from './middleware/public-pipeline';
import { checkAuthRateLimit, checkAdminRateLimit } from '@/forest/middleware/rate-limiter';
import {
  resolveTenantFromHostname,
  injectTenantRoutingHeaders,
  extractHostname,
  isInternalOrCanonicalHostname,
} from '@/tree/custom-domains/hostname-resolver';
import { getD1 } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import {
  applyErrorSecurityHeaders,
  handleLocaleRedirects,
  handleSignupTabRedirect,
  initializeWAEBinding,
} from './middleware/routing-helpers';

const logger = createLogger('middleware');

async function proxyImpl(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const startTime = Date.now();

  initializeWAEBinding();
  if (isInternalOrStatic(pathname)) return NextResponse.next();

  const pathLocale = pathname.split('/')[1];

  const localeRedirectRes = handleLocaleRedirects(request, pathname, pathLocale);
  if (localeRedirectRes) return localeRedirectRes;

  const signupRedirectRes = handleSignupTabRedirect(request, pathname, pathLocale);
  if (signupRedirectRes) return signupRedirectRes;

  if (request.method === 'OPTIONS') return handleCorsPrelight(origin);

  const authRateLimitResponse = await checkAuthRateLimit(request);
  if (authRateLimitResponse) return authRateLimitResponse;

  const adminRateLimitResponse = await checkAdminRateLimit(request);
  if (adminRateLimitResponse) return adminRateLimitResponse;

  const nonce = generateNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);

  const host = extractHostname(request);
  let db: D1Database | null = null;
  if (!isInternalOrCanonicalHostname(host)) {
    try {
      db = await getD1();
    } catch {
      // Graceful fallback if DB binding unavailable at edge init
    }
  }
  const tenantContext = await resolveTenantFromHostname(db, host);
  injectTenantRoutingHeaders(requestHeaders, tenantContext);

  if (requiresCsrfCheck(pathname, request.method) && !verifyCsrfToken(request)) {
    return csrfForbiddenResponse();
  }
  const needsCsrfSeed = request.method === 'GET' && !request.cookies.has(CSRF_COOKIE_NAME);

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
    const response = await proxyImpl(request);
    status = response.status;
    isError = status >= 400;
    return response;
  } catch (err) {
    isError = true;
    logger.error('proxyImpl threw', err instanceof Error ? err : new Error(String(err)));
    return applyErrorSecurityHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    );
  } finally {
    const duration = Date.now() - startTime;
    recordMetrics(request.nextUrl.pathname, duration, isError, {
      method: request.method,
      status,
    });
  }
}

export const middleware = proxy;

export const config = {
  matcher: ['/((?!_next|_worker|auth/callback|api/version|.*\\..*).*)'],
};
