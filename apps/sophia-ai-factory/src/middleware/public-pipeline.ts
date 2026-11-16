import { NextResponse, NextRequest } from 'next/server';
import { applyCorsHeaders } from './cors';
import {
  intlMiddleware,
  applySecurityHeaders,
  mergeIntlResponseHeaders,
  SUPPORTED_LOCALES,
} from './middleware-shared-config';
import { handleAeoMarkdownNegotiation } from './aeo-negotiation';

const SUPPORTED_LOCALE_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

const BARE_AUTH_APP_ROUTES = new Set([
  'reset-password',
  'dashboard', 'checkout', 'settings', 'products',
  'payments', 'admin', 'affiliates', 'affiliate-portal',
  'subscribers', 'webhook', 'investor-room',
]);

function stripLocalePrefix(pathname: string) {
  const parts = pathname.split('/');
  if (
    parts.length >= 3 &&
    SUPPORTED_LOCALE_SET.has(parts[1]) &&
    BARE_AUTH_APP_ROUTES.has(parts[2])
  ) {
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
    const redirectRes = applyCorsHeaders(NextResponse.redirect(target), origin);
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }

  // Canonical onboarding redirect: /setup-wizard → /[locale]/setup
  if (path === '/setup-wizard' || path === '/setup-wizard/') {
    const target = new URL('/vi/setup', request.url);
    const redirectRes = applyCorsHeaders(NextResponse.redirect(target), origin);
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }
  const setupWizardMatch = path.match(/^\/([^/]+)\/setup-wizard\/?$/);
  if (setupWizardMatch && SUPPORTED_LOCALE_SET.has(setupWizardMatch[1])) {
    const locale = setupWizardMatch[1];
    const target = new URL(`/${locale}/setup`, request.url);
    const redirectRes = applyCorsHeaders(NextResponse.redirect(target), origin);
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
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
    // Forward the stripped locale so the (app) route group renders the requested
    // language instead of falling back to the default locale.
    requestHeaders.set('x-next-intl-locale', localeForCookie);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const intlRequest = new NextRequest(request.url, {
    headers: requestHeaders,
    method: request.method,
  });
  const intlRes = intlMiddleware(intlRequest);
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
    mergeIntlResponseHeaders(redirectRes, intlRes, { skipLocation: true });
    applySecurityHeaders(redirectRes, nonce, needsCsrfSeed);
    return redirectRes;
  }

  mergeIntlResponseHeaders(response, intlRes);
  applySecurityHeaders(response, nonce, needsCsrfSeed);
  return response;
}
