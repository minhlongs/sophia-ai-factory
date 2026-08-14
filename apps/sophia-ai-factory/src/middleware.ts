import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateNonce } from '@/seed/security/nonce-utils';
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce';
import { verifyCsrfToken, requiresCsrfCheck, csrfForbiddenResponse, CSRF_COOKIE_NAME } from '@/seed/security/csrf';
import { record as recordMetrics, setWAEBinding } from '@/seed/observability/telemetry/metrics';
import { isInternalOrStatic } from './middleware-helpers';
import { handleCorsPrelight } from './middleware/cors';
import { handleApiPipeline } from './middleware/api-pipeline';
import { handleDashboardPipeline } from './middleware/dashboard-pipeline';
import { handlePublicPipeline } from './middleware/public-pipeline';
import { checkAuthRateLimit } from '@/forest/middleware/rate-limiter';
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';

/** L2: apply security headers to error responses that bypass the normal pipeline */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

// Initialize WAE binding once at module load (Cloudflare Workers env)
// The WAE binding is available via the global `env` in Workers, but in Next.js middleware
// we need to access it differently. We'll set it lazily on first request.
// For now, we expose a setter that can be called from the app router or setup.
let waeInitialized = false;

function initializeWAEBinding(): void {
  if (waeInitialized) return;
  // In Cloudflare Workers, the WAE binding is available in the global scope
  // when configured in wrangler.toml. We try to access it via the environment.
  // Note: In Next.js on Cloudflare Workers, bindings are available in the
  // request context via `env` property on the Request object (added by OpenNext).
  // We'll use a global to store the binding.
  try {
    // @ts-expect-error - Cloudflare Workers global bindings
    const globalEnv = globalThis.env || globalThis;
    if (globalEnv?.WAE) {
      setWAEBinding(globalEnv.WAE as AnalyticsEngineDataset);
    }
  } catch {
    // Ignore if not available
  }
  waeInitialized = true;
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

  // Initialize WAE binding on first request
  initializeWAEBinding();

  if (isInternalOrStatic(pathname)) return NextResponse.next();

const BARE_AUTH_APP_ROUTES = new Set([
  'pricing', 'setup-wizard', 'reset-password',
  'dashboard', 'checkout', 'settings', 'products', 'payments',
  'admin', 'affiliates', 'affiliate-portal', 'subscribers',
  'webhook', 'creator', 'investor-room',
]);

  const pathLocale = pathname.split('/')[1];

  // API routes bypass locale redirect — dispatched through handleApiPipeline below
  if (!pathname.startsWith('/api/')) {
  if (pathLocale && !isSupportedLocale(pathLocale) && !BARE_AUTH_APP_ROUTES.has(pathname.split('/')[1])) return redirectToDefault(request);
  }


  // /guides → /guide redirect (locale-prefixed paths — next.config redirects don't match on CF Workers)
  if (pathLocale && isSupportedLocale(pathLocale) && pathname === `/${pathLocale}/guides`) {
    const url = request.nextUrl.clone();
    url.pathname = `/${pathLocale}/guide`;
    return NextResponse.redirect(url, 308);
  }

  // E2E/SEO compatibility: tests and legacy links use /vi/login, /en/pricing etc
  // but routes are defined WITH [locale] prefix. Keep locale prefix in path.
  // This block is intentionally disabled - locale prefix is required for routing.
  // if (pathLocale && isSupportedLocale(pathLocale)) {
  //   const bare = pathname.replace(/^\/(en|vi)/, '') || '/';
  //   const url = request.nextUrl.clone();
  //   url.pathname = bare;
  //   if (url.pathname !== pathname) {
  //     return NextResponse.redirect(url, 308);
  //   }
  // }

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
  let isError = false;
  let status = 200;
  try {
    const response = await proxyImpl(request);
    status = response.status;
    isError = status >= 400;
    return response;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    isError = true;
    // L2: return a safe error response with security headers instead of throwing
    return applySecurityHeaders(
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
  matcher: ['/((?!_next|_worker|auth/callback|api/version|.*\\..*).*)'],
};
