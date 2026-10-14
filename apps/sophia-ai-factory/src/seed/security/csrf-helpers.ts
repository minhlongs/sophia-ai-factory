/**
 * Constant-time string comparison, cookie parsing, and path normalization for CSRF protection.
 * @module seed/security/csrf-helpers
 */

export const SUPPORTED_LOCALES = ['vi', 'en'];

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function pathnameWithoutLocale(pathname: string): string {
  for (const locale of SUPPORTED_LOCALES) {
    if (pathname === '/' + locale || pathname.startsWith('/' + locale + '/')) {
      return pathname.slice(locale.length + 1) || '/';
    }
  }
  return pathname;
}

/**
 * Parse a named cookie value from the raw Cookie header string.
 */
export function parseCookieHeader(cookieHeader: string, name: string): string | undefined {
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key.trim() === name) return rest.join('=').trim();
  }
  return undefined;
}
