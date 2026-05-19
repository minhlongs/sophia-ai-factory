import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { getAuth } from '@/seed/auth/better-auth-server'
import { applyCorsHeaders, handleCorsPrelight } from '@/seed/security/cors-security-configuration'
 
import { emitUsageEvent } from '@/forest/usage-metering'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { isInternalOrStatic, pathnameWithoutLocale, isAdminAuthorized } from './middleware-helpers'
import { handleApiRoute } from './middleware-api-handler'
import { getD1Raw } from '@/seed/db/client'
import {
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrfToken,
  requiresCsrfCheck,
  csrfForbiddenResponse,
  CSRF_COOKIE_NAME,
} from '@/seed/security/csrf'
import { buildCSPHeader } from '@/seed/security/content-security-policy-configuration'
import { CSP_NONCE_HEADER } from '@/seed/security/get-csp-nonce'
import { isSessionMfaPending } from '@/seed/auth/mfa/login-challenge'

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
      // Check order: cookie → KV cache → D1 (write-through to KV on hit, 24h TTL).
      // P90 latency: ~80ms (D1 round-trip) → ~5ms (KV hit) per /dashboard GET.
      const uid12 = (session.user?.id ?? '').slice(0, 12)
      if (cleanPath === '/dashboard') {
        let wizardDone = uid12 ? request.cookies.has(`wizard_done_${uid12}`) : false
        const kvBinding = (globalThis as Record<string, unknown>)['EXPERIMENT_KV'] as KVNamespace | undefined
        const kvCacheKey = session.user?.id ? `onboard:${session.user.id.slice(0, 16)}` : null
        if (!wizardDone && kvBinding && kvCacheKey) {
          try {
            const cached = await kvBinding.get(kvCacheKey)
            if (cached === '1') wizardDone = true
          } catch (kvErr) {
            // Non-fatal — proceed to D1 check
            logger.warn('[Middleware] KV onboard cache read failed', toError(kvErr))
          }
        }
        if (!wizardDone && session.user?.id) {
          try {
            const db = await getD1Raw()
            const row = await db
              .prepare('SELECT onboarding_completed_at FROM user_profiles WHERE user_id = ? LIMIT 1')
              .bind(session.user.id)
              .first<{ onboarding_completed_at: number | null }>()
            wizardDone = Boolean(row?.onboarding_completed_at)
            // Write-through: cache positive result in KV for 24h
            if (wizardDone && kvBinding && kvCacheKey) {
              kvBinding.put(kvCacheKey, '1', { expirationTtl: 86400 }).catch((kvPutErr: unknown) => {
                logger.warn('[Middleware] KV onboard cache write failed', toError(kvPutErr))
              })
            }
          } catch (dbErr) {
            // Non-fatal — fall back to cookie value already set above
            logger.warn('[Middleware] onboarding_completed_at lookup failed (cookie fallback)', toError(dbErr))
          }
        }
        if (!wizardDone) {
          return NextResponse.redirect(new URL('/setup-wizard', request.url))
        }
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

// Note: `setup-wizard` was previously excluded from the matcher, which meant
// middleware never ran on it and no CSP nonce was attached → React bootstrap
// inline scripts triggered a CSP violation on every wizard pageview (verified
// via Playwright trace 2026-05-19). The handler at line 199 already routes
// `setup-wizard` correctly, so removing the exclusion lets it pick up nonce +
// CSP headers like any other public page.
export const config = {
  matcher: ['/((?!api|_next|_worker|auth/callback|.*\\..*).*)'],
}
