/**
 * CSRF Protection — Double-Submit Cookie Pattern
 *
 * Token set as cookie on GET requests; mutations must echo it in x-csrf-token header.
 * Edge runtime compatible — uses Web Crypto API only (no node:crypto).
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  timingSafeEqual,
  pathnameWithoutLocale,
  parseCookieHeader,
} from './csrf-helpers'

/** Cookie name visible to JS (httpOnly=false so client can read and send in header) */
export const CSRF_COOKIE_NAME = 'csrf-token'
/** Request header where client must echo the token */
export const CSRF_HEADER_NAME = 'x-csrf-token'

/** Safe methods that never mutate state */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const CSRF_BYPASS_PREFIXES = ['/api/auth/', '/api/webhooks/', '/api/csp-report']
const CRON_PREFIX = '/api/cron/'

/**
 * Verify that a cron request is authentic.
 */
export function validateCronRequest(request: NextRequest): boolean {
  const pathname = new URL(request.url).pathname
  if (!pathname.startsWith(CRON_PREFIX)) {
    return false
  }

  if (request.headers.get('cf-cron-trigger')) {
    return true
  }

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

  const internalCronSecret = request.headers.get('x-internal-cron-secret')
  const expectedInternalSecret = process.env.INTERNAL_CRON_SECRET
  if (internalCronSecret && expectedInternalSecret && timingSafeEqual(internalCronSecret, expectedInternalSecret)) {
    return true
  }

  return false
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
 * Attach a csrf-token cookie to the response.
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
 * Verify that the incoming request carries a valid CSRF token.
 */
export function verifyCsrfToken(request: NextRequest): boolean {
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
 */
export function requiresCsrfCheck(pathname: string, method: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false
  const cleanPath = pathnameWithoutLocale(pathname)
  for (const prefix of CSRF_BYPASS_PREFIXES) {
    if (cleanPath.startsWith(prefix)) return false
  }
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
