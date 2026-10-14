import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { setWAEBinding } from '@/seed/observability/telemetry/metrics';
import { resolveApacLocale } from '@/tree/localization/geo-router';
import { SUPPORTED_LOCALES } from './middleware-shared-config';
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';

/** L2: apply security headers to error responses that bypass the normal pipeline */
export function applyErrorSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

let waeInitialized = false;

export function initializeWAEBinding(): void {
  if (waeInitialized) return;
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

export function isSupportedLocale(segment: string | undefined): boolean {
  return segment !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(segment);
}

export function isUnsupportedLocale(segment: string | undefined): boolean {
  if (!segment) return false;
  const isLocalePattern = /^[a-z]{2}(?:-[a-zA-Z]{2,4})?$/i.test(segment);
  return isLocalePattern && !isSupportedLocale(segment);
}

export function redirectToDefault(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  return NextResponse.redirect(url);
}

const REDIRECTS: Record<string, string> = {
  '/docs': '/guide',
  '/guides': '/guide',
  '/faq': '/guide',
  '/help': '/guide',
};

export function handleLocaleRedirects(
  request: NextRequest,
  pathname: string,
  pathLocale: string | undefined,
): NextResponse | null {
  if (pathname.startsWith('/api/')) return null;

  const barePath =
    pathLocale && isSupportedLocale(pathLocale)
      ? pathname.slice(`/${pathLocale}`.length) || '/'
      : pathname;

  if (REDIRECTS[barePath]) {
    const locale = isSupportedLocale(pathLocale)
      ? pathLocale!
      : resolveApacLocale(request.headers.get('cf-ipcountry'), request.headers.get('accept-language'));
    return NextResponse.redirect(new URL(`/${locale}${REDIRECTS[barePath]}`, request.url), 307);
  }

  if (isUnsupportedLocale(pathLocale)) {
    return redirectToDefault(request);
  }

  return null;
}

export function handleSignupTabRedirect(
  request: NextRequest,
  pathname: string,
  pathLocale: string | undefined,
): NextResponse | null {
  const { searchParams: sp } = request.nextUrl;
  if (sp.get('tab') !== 'signup') return null;

  const isHomepage = pathname === '/' || (isSupportedLocale(pathLocale) && pathname === `/${pathLocale}`);
  if (!isHomepage) return null;

  const locale = isSupportedLocale(pathLocale)
    ? pathLocale!
    : resolveApacLocale(request.headers.get('cf-ipcountry'), request.headers.get('accept-language'));

  const p = new URLSearchParams({ tab: 'signup' });
  for (const k of ['coupon', 'tier', 'redirect'] as const) {
    const v = sp.get(k);
    if (v) p.set(k, v);
  }
  return NextResponse.redirect(new URL(`/${locale}/login?${p.toString()}`, request.url));
}
