import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { getAuth } from './lib/better-auth-server'
import { applyCorsHeaders, handleCorsPrelight } from './lib/security/cors-security-configuration'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- mekong-exempt: middleware needs usage-metering for request-level tracking
import { emitUsageEvent } from './lib/usage-metering'
import { logger } from './lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import { isInternalOrStatic, pathnameWithoutLocale, isAdminAuthorized } from './middleware-helpers'
import { handleApiRoute } from './middleware-api-handler'
import {
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrfToken,
  requiresCsrfCheck,
  csrfForbiddenResponse,
  CSRF_COOKIE_NAME,
} from './lib/security/csrf'
import { buildCSPHeader } from './lib/security/content-security-policy-configuration'
import { CSP_NONCE_HEADER } from './lib/security/get-csp-nonce'
import { isSessionMfaPending } from './lib/auth/mfa/login-challenge'

/**
 * Generate a cryptographically random nonce for this request.
 * Uses Web Crypto API — compatible with Edge runtime (no node:crypto needed).
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

const intlMiddleware = createMiddleware({
  locales: ['en', 'vi'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})

/**
 * Attach the per-request CSP nonce header to a response and forward the nonce
 * to Server Components via the x-csp-nonce request header clone.
 */
function attachCspHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('Content-Security-Policy', buildCSPHeader(nonce))
  // Forward nonce downstream so Server Components can read it via getCspNonce()
  response.headers.set(CSP_NONCE_HEADER, nonce)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')
  const startTime = Date.now()

  if (isInternalOrStatic(pathname)) return NextResponse.next()
  if (request.method === 'OPTIONS') return handleCorsPrelight(origin)

  // Generate a fresh nonce for every HTML-bearing request.
  // API routes and static assets don't need a nonce but get a strict CSP too.
  const nonce = generateNonce()

  // Mutate the *incoming* request headers so Server Components see the nonce
  // when they call getCspNonce() → headers().get('x-csp-nonce').
  // NextResponse.next({ request: { headers } }) clones the request headers.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(CSP_NONCE_HEADER, nonce)

  // CSRF protection — double-submit cookie pattern
  if (requiresCsrfCheck(pathname, request.method)) {
    if (!verifyCsrfToken(request)) return csrfForbiddenResponse()
  }

  // On safe GET requests: seed csrf-token cookie if absent so the client can
  // read it and send it back on the next mutating request.
  const needsCsrfSeed =
    request.method === 'GET' &&
    !request.cookies.has(CSRF_COOKIE_NAME)

  if (pathname.startsWith('/api')) {
    const blocked = await handleApiRoute(request, pathname, startTime)
    if (blocked) return blocked
  }

  const isConfigured = process.env.NEXT_PUBLIC_IS_CONFIGURED === 'true' || process.env.IS_CONFIGURED === 'true'
  if (!isConfigured) {
    const cleanedForSetup = pathnameWithoutLocale(pathname)
    if (cleanedForSetup.startsWith('/dashboard') || cleanedForSetup.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/setup-wizard', request.url))
    }
  }

  if (pathname.startsWith('/admin') || pathname.includes('/admin/')) {
    if (pathname === '/api/auth') return NextResponse.next()
    if (isAdminAuthorized(request)) {
      const res = intlMiddleware(request)
      attachCspHeaders(res as NextResponse, nonce)
      return res
    }
    const url = request.nextUrl.clone()
    url.pathname = '/api/auth'
    return NextResponse.rewrite(url)
  }

  const cleanPath = pathnameWithoutLocale(pathname)

  // MFA challenge paths are always allowed (pending or not) so the user can complete verification
  const isMfaChallengePath =
    cleanPath === '/auth/mfa-challenge' ||
    pathname.startsWith('/api/auth/mfa/challenge')

  if (cleanPath.startsWith('/dashboard')) {
    try {
      const auth = getAuth()
      if (!auth) return NextResponse.redirect(new URL('/login', request.url))
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return NextResponse.redirect(new URL('/login', request.url))

      // Enforce MFA challenge: redirect to MFA page if session is pending
      if (!isMfaChallengePath && session.session?.id) {
        try {
          const pending = await isSessionMfaPending(session.session.id)
          if (pending) {
            return NextResponse.redirect(new URL('/auth/mfa-challenge', request.url))
          }
        } catch (mfaErr) {
          // Non-fatal — log and allow through to avoid locking out users on DB errors
          logger.error('[Middleware] MFA pending check error', toError(mfaErr))
        }
      }

      // New-user onboarding: redirect to setup wizard if wizard not yet completed.
      // Cookie is per-user (`wizard_done_<uid12>`) so multiple users on the same
      // browser don't share completion state. Set by /api/setup/save on success.
      const uid12 = (session.user?.id ?? '').slice(0, 12)
      const wizardDone = uid12 ? request.cookies.has(`wizard_done_${uid12}`) : false
      if (!wizardDone && cleanPath === '/dashboard') {
        return NextResponse.redirect(new URL('/setup-wizard', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    const dashRes = NextResponse.next({ request: { headers: requestHeaders } })
    const intlRes = intlMiddleware(request)
    const intlDashLoc = intlRes.headers.get('location')
    // Honor locale redirects for dashboard paths too
    if (intlDashLoc) {
      const redirectRes = NextResponse.redirect(new URL(intlDashLoc, request.url))
      intlRes.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'location') redirectRes.headers.set(key, value)
      })
      attachCspHeaders(redirectRes, nonce)
      if (needsCsrfSeed) setCsrfCookie(redirectRes, generateCsrfToken())
      return redirectRes
    }
    // Copy intl headers (locale cookies, etc.) into our nonce-aware response
    intlRes.headers.forEach((value, key) => {
      dashRes.headers.set(key, value)
    })
    attachCspHeaders(dashRes, nonce)
    if (needsCsrfSeed) setCsrfCookie(dashRes, generateCsrfToken())
    return dashRes
  }

  if (pathname.startsWith('/auth/callback')) return NextResponse.next()

  if (pathname.startsWith('/api') || pathname.startsWith('/setup-wizard')) {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    const responseTimeMs = Date.now() - startTime
    response.headers.set('X-Response-Time-Ms', String(responseTimeMs))

    const receiptHeader = request.headers.get('x-raas-receipt')
    if (receiptHeader) response.headers.set('X-RaaS-Receipt', receiptHeader)

    const quotaRemainingJson = request.headers.get('x-quota-remaining')
    if (quotaRemainingJson) {
      try {
        const remaining = JSON.parse(quotaRemainingJson)
        const resetTimestamp = Math.floor(Date.now() / 1000) + 3600
        response.headers.set('X-RateLimit-Limit', String(remaining.hourlyCredits || remaining.dailyCredits))
        response.headers.set('X-RateLimit-Remaining', String(remaining.hourlyCredits ?? remaining.dailyCredits))
        response.headers.set('X-RateLimit-Reset', String(resetTimestamp))
      } catch (error) {
        logger.error('[Proxy] Failed to parse quota remaining', toError(error))
      }
    }

    const raasTier = request.headers.get('x-raas-tier')
    emitUsageEvent(request, { status: response.status, headers: response.headers }, { tier: raasTier || 'BASIC' }).catch(err => {
      logger.error('[Proxy] Failed to emit success usage event', err)
    })

    attachCspHeaders(response, nonce)
    if (needsCsrfSeed) setCsrfCookie(response, generateCsrfToken())
    return response
  }

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } })
  const intlFinalRes = intlMiddleware(request)
  const intlLocation = intlFinalRes.headers.get('location')
  // Honor locale redirects (e.g., / → /vi for Accept-Language: vi, /en → /)
  if (intlLocation) {
    const redirectRes = applyCorsHeaders(NextResponse.redirect(new URL(intlLocation, request.url)), origin)
    intlFinalRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'location') redirectRes.headers.set(key, value)
    })
    attachCspHeaders(redirectRes, nonce)
    if (needsCsrfSeed) setCsrfCookie(redirectRes, generateCsrfToken())
    return redirectRes
  }
  // Merge intl + cors headers
  ;(intlFinalRes as NextResponse).headers.forEach((value, key) => {
    finalResponse.headers.set(key, value)
  })
  attachCspHeaders(finalResponse, nonce)
  if (needsCsrfSeed) setCsrfCookie(finalResponse, generateCsrfToken())
  return finalResponse
}

export const middleware = proxy

export const config = {
  matcher: ['/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)'],
}
