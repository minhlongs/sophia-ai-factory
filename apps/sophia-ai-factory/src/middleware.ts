import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { getAuth } from './lib/better-auth-server'
import { applyCorsHeaders, handleCorsPrelight } from './lib/security/cors-security-configuration'
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

const intlMiddleware = createMiddleware({
  locales: ['en', 'vi'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
})

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const origin = request.headers.get('origin')
  const startTime = Date.now()

  if (isInternalOrStatic(pathname)) return NextResponse.next()
  if (request.method === 'OPTIONS') return handleCorsPrelight(origin)

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
  } else if (pathname.startsWith('/setup-wizard')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (pathname.startsWith('/admin') || pathname.includes('/admin/')) {
    if (pathname === '/api/auth') return NextResponse.next()
    if (isAdminAuthorized(request)) return intlMiddleware(request)
    const url = request.nextUrl.clone()
    url.pathname = '/api/auth'
    return NextResponse.rewrite(url)
  }

  const cleanPath = pathnameWithoutLocale(pathname)
  if (cleanPath.startsWith('/dashboard')) {
    try {
      const auth = getAuth()
      if (!auth) return NextResponse.redirect(new URL('/login', request.url))
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) return NextResponse.redirect(new URL('/login', request.url))
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return intlMiddleware(request)
  }

  if (pathname.startsWith('/auth/callback')) return NextResponse.next()

  if (pathname.startsWith('/api') || pathname.startsWith('/setup-wizard')) {
    const response = NextResponse.next()
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

    if (needsCsrfSeed) setCsrfCookie(response, generateCsrfToken())
    return response
  }

  const finalResponse = applyCorsHeaders(intlMiddleware(request), origin)
  if (needsCsrfSeed) setCsrfCookie(finalResponse as NextResponse, generateCsrfToken())
  return finalResponse
}

export const middleware = proxy

export const config = {
  matcher: ['/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)'],
}
