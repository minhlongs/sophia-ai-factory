import { NextResponse, NextRequest } from 'next/server';
import { applyCorsHeaders } from './cors';
import { intlMiddleware, applySecurityHeaders } from './middleware-shared-config';

// Routes without [locale] segment — intlMiddleware would 307-redirect them,
// breaking users and E2E tests. Detect locale-prefixed versions and strip the prefix
// before passing to intlMiddleware so the request proceeds without any redirect.
const BARE_AUTH_APP_ROUTES = new Set([
  'pricing', 'setup-wizard', 'register', 'reset-password',
  'login', 'dashboard', 'checkout', 'settings', 'products',
  'payments', 'admin', 'affiliates', 'affiliate-portal',
  'subscribers', 'webhook', 'creator', 'investor-room',
]);

function stripLocalePrefix(pathname: string) {
  const parts = pathname.split('/');
  if (parts.length >= 2 && BARE_AUTH_APP_ROUTES.has(parts[2])) {
    return pathname.replace(/^\/[^/]+/, '');
  }
  return null;
}

export async function handlePublicPipeline(
  request: NextRequest,
  origin: string | null,
  requestHeaders: Headers,
  nonce: string,
  needsCsrfSeed: boolean,
): Promise<NextResponse> {
  // Explicit hard redirects: /dashboard/* bare auth routes → locale-prefixed versions.
  // This follows the same pattern as the .orchestrate/260812-1045 plan and avoids
  // adding these paths to BARE_AUTH_APP_ROUTES (which would cause intlMiddleware
  // to loop by stripping the wrong path segment).
  const path = request.nextUrl.pathname;
  const BARE_REDIRECTS: Record<string, string> = {
    '/dashboard/login': '/login',
    '/dashboard/signup': '/signup',
  };
  if (BARE_REDIRECTS[path]) {
    const target = new URL(BARE_REDIRECTS[path], request.url);
    return applyCorsHeaders(NextResponse.redirect(target), origin);
  }

  // If request has a locale prefix on a bare route, rewrite to bare path first
  const stripped = stripLocalePrefix(request.nextUrl.pathname);
  let localeForCookie: string | null = null;
  if (stripped) {
    localeForCookie = request.nextUrl.pathname.split('/')[1];
    const url = request.nextUrl.clone();
    url.pathname = stripped;
    request = new NextRequest(url.toString(), request);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const intlRes = intlMiddleware(request);
  const location = intlRes.headers.get('location');

  // If intlMiddleware tries to redirect a bare route (no [locale] segment),
  // bypass it — these routes are intentionally locale-agnostic.
  if (location) {
    const pathLocale = request.nextUrl.pathname.split('/')[1];
    if (BARE_AUTH_APP_ROUTES.has(pathLocale || '')) {
      const bypass = NextResponse.rewrite(new URL(request.url), { request: { headers: requestHeaders } });
      if (localeForCookie) {
        bypass.cookies.set('NEXT_LOCALE', localeForCookie, { path: '/', maxAge: 31536000 });
      }
      applySecurityHeaders(bypass, nonce, needsCsrfSeed);
      return bypass;
    }
  }

  if (location) {
    const redirectRes = applyCorsHeaders(NextResponse.redirect(new URL(location, request.url)), origin);
    intlRes.headers.forEach((v, k) => { if (k.toLowerCase() !== 'location') redirectRes.headers.set(k, v); });
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }

  intlRes.headers.forEach((v, k) => response.headers.set(k, v));
  applySecurityHeaders(response, nonce, needsCsrfSeed);
  return response;
}
