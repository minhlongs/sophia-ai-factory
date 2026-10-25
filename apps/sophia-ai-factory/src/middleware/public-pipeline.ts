import { NextResponse, NextRequest } from 'next/server';
import { applyCorsHeaders } from './cors';
import { intlMiddleware, applySecurityHeaders } from './middleware-shared-config';
import { handleAeoMarkdownNegotiation } from './aeo-negotiation';

const BARE_AUTH_APP_ROUTES = new Set([
  'reset-password',
  'dashboard', 'checkout', 'settings', 'products',
  'payments', 'admin', 'affiliates', 'affiliate-portal',
  'subscribers', 'webhook', 'investor-room',
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
  const path = request.nextUrl.pathname;
  const BARE_REDIRECTS: Record<string, string> = {
    '/dashboard/login': '/login',
    '/dashboard/signup': '/signup',
  };
  if (BARE_REDIRECTS[path]) {
    const target = new URL(BARE_REDIRECTS[path], request.url);
    return applyCorsHeaders(NextResponse.redirect(target), origin);
  }

  // Canonical onboarding redirect: /setup-wizard → /[locale]/setup
  if (path === '/setup-wizard' || path === '/setup-wizard/') {
    const target = new URL('/vi/setup', request.url);
    return applyCorsHeaders(NextResponse.redirect(target), origin);
  }
  const setupWizardMatch = path.match(/^\/(en|vi|ja|ko|th)\/setup-wizard\/?$/);
  if (setupWizardMatch) {
    const locale = setupWizardMatch[1];
    const target = new URL(`/${locale}/setup`, request.url);
    return applyCorsHeaders(NextResponse.redirect(target), origin);
  }

  // Dual-Read AEO/GEO Markdown negotiation (runs before next-intl 307 redirects)
  const aeoRes = handleAeoMarkdownNegotiation(request, requestHeaders, nonce, needsCsrfSeed);
  if (aeoRes) {
    return aeoRes;
  }

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
