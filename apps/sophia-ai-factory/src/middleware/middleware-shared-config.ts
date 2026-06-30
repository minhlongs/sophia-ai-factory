/**
 * Shared middleware configuration — locale list, intl middleware factory,
 * and the CSP+CSRF applySecurity helper used by all pipeline modules.
 *
 * Extracted from the three pipeline files (api, dashboard, public) to keep
 * locale config and security header application in a single source of truth.
 */
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { buildCSPHeader } from '@/seed/security/content-security-policy-configuration';
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce';
import { generateCsrfToken, setCsrfCookie } from '@/seed/security/csrf';

export const SUPPORTED_LOCALES = ['en', 'vi'] as const;

export const intlMiddleware = createMiddleware({
  locales: SUPPORTED_LOCALES,
  defaultLocale: 'vi',
  localePrefix: 'always',
});

export function applySecurityHeaders(
  response: NextResponse,
  nonce: string,
  needsCsrfSeed: boolean,
): void {
  response.headers.set('Content-Security-Policy', buildCSPHeader(nonce));
  response.headers.set(CSP_NONCE_HEADER, nonce);
  if (needsCsrfSeed) setCsrfCookie(response, generateCsrfToken());
}
