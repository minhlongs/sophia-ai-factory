/**
 * Dual-Read AEO/GEO Content Negotiation helper for Public Pipeline.
 * Intercepts `Accept: text/markdown` and `.md` requests on public routes
 * BEFORE next-intl issues a 307 redirect that would strip custom headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders } from './middleware-shared-config';

const NON_NEGOTIABLE_PREFIXES = [
  '/dashboard',
  '/admin',
  '/api',
  '/auth',
  '/setup',
  '/checkout',
  '/onboarding',
  '/welcome',
  '/redeem',
  '/payment-success',
  '/login',
  '/signup',
  '/reset-password',
];

export function isAeoMarkdownNegotiatedRequest(request: NextRequest): boolean {
  if (request.method !== 'GET') return false;
  const rawPath = request.nextUrl.pathname;
  const barePath = rawPath.replace(/^\/(en|vi|ja|ko|th)(?=\/|$)/, '') || '/';

  for (const prefix of NON_NEGOTIABLE_PREFIXES) {
    if (barePath === prefix || barePath.startsWith(`${prefix}/`)) {
      return false;
    }
  }

  if (rawPath.toLowerCase().endsWith('.md')) {
    return true;
  }

  const accept = (request.headers.get('accept') ?? '').toLowerCase();
  return accept.includes('text/markdown') || accept.includes('text/x-markdown');
}

export function handleAeoMarkdownNegotiation(
  request: NextRequest,
  requestHeaders: Headers,
  nonce: string,
  needsCsrfSeed: boolean,
): NextResponse | null {
  if (!isAeoMarkdownNegotiatedRequest(request)) {
    return null;
  }

  const rawPath = request.nextUrl.pathname;
  const localeMatch = rawPath.match(/^\/(en|vi)(?=\/|$)/);
  const acceptLang = (request.headers.get('accept-language') ?? '').toLowerCase();
  const inferredLocale = localeMatch
    ? localeMatch[1]
    : acceptLang.startsWith('en')
      ? 'en'
      : 'vi';

  const targetUrl = request.nextUrl.clone();
  targetUrl.pathname = '/api/aeo/markdown';
  targetUrl.searchParams.set('path', rawPath);
  targetUrl.searchParams.set('locale', inferredLocale);

  const response = NextResponse.rewrite(targetUrl, {
    request: { headers: requestHeaders },
  });
  response.headers.set('Vary', 'Accept, Accept-Language');
  applySecurityHeaders(response, nonce, needsCsrfSeed);
  return response;
}
