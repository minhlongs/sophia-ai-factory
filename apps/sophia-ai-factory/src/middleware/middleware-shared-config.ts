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

export const SUPPORTED_LOCALES = [
  'en',
  'vi',
  'ja',
  'ko',
  'zh',
  'es',
  'fr',
  'de',
  'th',
  'id',
  'hi',
  'ar',
] as const;

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
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (needsCsrfSeed) setCsrfCookie(response, generateCsrfToken());
}

/**
 * Copies headers from `intlRes` onto `target` while merging Next.js's
 * comma-separated `x-middleware-override-headers` list instead of overwriting it.
 *
 * `next-intl` constructs its own `new Headers({ 'x-next-intl-locale': locale })`,
 * so `intlRes` carries `x-middleware-override-headers: x-next-intl-locale`. A raw
 * `target.headers.set(k, v)` would clobber upstream request headers (`x-csp-nonce`,
 * `x-tenant-*`) already encoded on `target` by `NextResponse.next({ request: { headers } })`.
 */
export function mergeIntlResponseHeaders(
  target: NextResponse,
  intlRes: NextResponse,
  options?: { skipLocation?: boolean },
): void {
  const OVERRIDE_KEY = 'x-middleware-override-headers';
  const existingOverrides = target.headers.get(OVERRIDE_KEY);

  intlRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (options?.skipLocation && lower === 'location') return;
    if (lower === OVERRIDE_KEY && existingOverrides) {
      const merged = new Set(
        `${existingOverrides},${value}`
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      );
      target.headers.set(OVERRIDE_KEY, Array.from(merged).join(','));
      return;
    }
    target.headers.set(key, value);
  });
}
