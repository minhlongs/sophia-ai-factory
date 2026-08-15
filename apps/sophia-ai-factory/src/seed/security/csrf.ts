/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * Token set as cookie on GET requests; mutations must echo it in x-csrf-token header.
 * Edge runtime compatible — uses Web Crypto API only (no node:crypto).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Cookie name visible to JS (httpOnly=false so client can read and send in header) */
export const CSRF_COOKIE_NAME = 'csrf-token'
/** Request header where client must echo the token */
export const CSRF_HEADER_NAME = 'x-csrf-token'

/** Safe methods that never mutate state */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Paths that bypass CSRF checks entirely:
 * - /api/auth/*   — Better Auth manages its own session/CSRF state.
 * - /api/webhooks/* — authenticated via provider signature (NOWPayments, PayOS,
 *   Telegram IPN, etc.), not browser cookies.
 * - /api/csp-report — browser-initiated CSP violation reports; no user action.
 *
 * /api/cron/* is NOT in this list; it uses CRON_PREFIX + validateCronRequest()
 * to enforce INTERNAL_CRON_SECRET / Cloudflare Cron header / Authorization bearer.
 */
// CSP violation reports are POSTed by the browser without a CSRF token —
// the request is browser-initiated, not user form-initiated. Bypass.
const CSRF_BYPASS_PREFIXES = ['/api/auth/', '/api/webhooks/', '/api/csp-report']
const CRON_PREFIX = '/api/cron/'
const SUPPORTED_LOCALES = ['vi', 'en']

/**
 * Verify that a cron request is authentic.
 * Cron endpoints bypass CSRF but require either:
 * - Cloudflare Cron header (cf-cron-trigger) OR
 * - Internal cron secret (x-internal-cron-secret) OR
 * - Authorization: Bearer <CRON_SECRET> (from scheduled handler)
 */
export function validateCronRequest(request: NextRequest): boolean {
  const pathname = new URL(request.url).pathname
  if (!pathname.startsWith(CRON_PREFIX)) {
    return false // Not a cron route
  }

  // Check Cloudflare Cron header (when triggered by CF Scheduler directly)
  if (request.headers.get('cf-cron-trigger')) {
    return true
  }

  // Check Authorization: Bearer <CRON_SECRET> (sent by scheduled handler)
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET
  if (authHeader && cronSecret) {
    const bearerPrefix = 'Bearer '
    if (authHeader.startsWith(bearerPrefix)) {
      const token = authHeader.slice(bearerPrefix.length)
      if (timingSafeEqual(token, cronSecret)) {
        return true
      }
    }
  }

  // Check internal cron secret for manual/alternative triggers (legacy)
  const internalCronSecret = request.headers.get('x-internal-cron-secret')
  const expectedInternalSecret = process.env.INTERNAL_CRON_SECRET
  if (internalCronSecret && expectedInternalSecret && timingSafeEqual(internalCronSecret, expectedInternalSecret)) {
    return true
  }

  return false
}

function pathnameWithoutLocale(pathname: string): string {
for (const locale of SUPPORTED_LOCALES) {
if (pathname === '/' + locale || pathname.startsWith('/' + locale + '/')) {
return pathname.slice(locale.length + 1) || '/'
}
}
return pathname
}

/**
 * Generate a 32-byte random hex token using Web Crypto (edge-compatible).
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true only when both strings are identical.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Attach a csrf-token cookie to the response.
 *
 * Secure in production — cookie uses Secure flag when NODE_ENV=production.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieOptions = [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    'SameSite=Strict',
    isProduction ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')

  response.headers.append('Set-Cookie', cookieOptions)
}

/**
 * Parse a named cookie value from the raw Cookie header string.
 * Fallback for environments where NextRequest.cookies may not parse correctly.
 */
function parseCookieHeader(cookieHeader: string, name: string): string | undefined {
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.trim().split('=')
    if (key.trim() === name) return rest.join('=').trim()
  }
  return undefined
}

/**
 * Verify that the incoming request carries a valid CSRF token.
 * Compares the csrf-token cookie against the x-csrf-token header
 * using a constant-time compare.
 *
 * Returns true when the token is valid (request should proceed),
 * false when it is missing or mismatched.
 */
export function verifyCsrfToken(request: NextRequest): boolean {
  // Prefer NextRequest.cookies API; fall back to manual header parse for
  // environments (e.g. jsdom / edge) where the cookies accessor may not work.
  let cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  if (!cookieToken) {
    const cookieHeader = request.headers.get('cookie') ?? ''
    cookieToken = cookieHeader ? parseCookieHeader(cookieHeader, CSRF_COOKIE_NAME) : undefined
  }
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken) return false
  return timingSafeEqual(cookieToken, headerToken)
}

/**
 * Determine whether a request needs CSRF validation.
 *
 * Returns false (skip check) when:
 * - Method is GET / HEAD / OPTIONS
 * - Pathname is under a bypass prefix
 */
export function requiresCsrfCheck(pathname: string, method: string): boolean {
	if (SAFE_METHODS.has(method.toUpperCase())) return false
	// Strip locale prefix for bypass matching (e.g., /vi/api/auth/... → /api/auth/...)
	const cleanPath = pathnameWithoutLocale(pathname)
	for (const prefix of CSRF_BYPASS_PREFIXES) {
	if (cleanPath.startsWith(prefix)) return false
	}
	// Cron endpoints use separate validation (validateCronRequest)
	if (cleanPath.startsWith(CRON_PREFIX)) return false
	return true
}

/**
 * Build a 403 JSON response for a CSRF token mismatch.
 */
export function csrfForbiddenResponse(): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: 'csrf_token_invalid' }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
