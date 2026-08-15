import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/seed/security/rate-limiting-middleware'
import { getCurrentUserFromHeaders, AuthSystemError } from '@/seed/auth/better-auth-session'
import { getUserTier } from '@/seed/db/get-user-tier'
import { isPublicApiRoute } from '@/forest/middleware/auth-guard'
import { emitUsageEvent } from '@/tree/usage-metering'
import { logger } from '@/seed/utils/logger-utility'
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret'
import { track } from '@/forest/telemetry/track'
import { D1Events } from '@/forest/telemetry/d1-event-types'
import { tenantIsolationMiddleware } from '@/forest/middleware/tenant-isolation'

// Returns a blocking response, or null to continue
export async function handleApiRoute(request: NextRequest, pathname: string, startTime: number): Promise<NextResponse | null> {
 const isolationResult = await tenantIsolationMiddleware(request)
 if (isolationResult) return isolationResult

 // Webhook version pinning — internal secret required during canary
 if (
   pathname.startsWith('/api/webhooks/nowpayments') ||
   pathname.startsWith('/api/webhooks/payos') ||
   pathname.startsWith('/api/webhooks/telegram')
 ) {
   // Enforce only when INTERNAL_API_SECRET is configured; skip during migration window
   if (process.env.INTERNAL_API_SECRET && !verifyInternalSecret(request)) {
     return new Response(
       JSON.stringify({ error: 'canary_window', message: 'Webhook pinned to stable version — retry shortly' }),
       { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
     ) as unknown as NextResponse
   }
 }

 // Tier-aware tighter limits live inside individual routes via @/forest/middleware/rate-limit-wrapper.
 // The base IP-bucket here is the first line of defense for all `/api/*`; routes that incur LLM/video
 // cost (agent-chat, missions POST, campaigns/create, factory/url-to-revenue) layer additional
 // `withRateLimit` above this baseline to cap per-tenant per-tier abuse.
 const identifier = getClientIdentifier(request)
 let rateLimitConfig = RATE_LIMITS.api as typeof RATE_LIMITS.api | typeof RATE_LIMITS.auth | typeof RATE_LIMITS.webhook | typeof RATE_LIMITS.discovery

 if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/admin') || pathname.startsWith('/api/user/byok')) {
 rateLimitConfig = RATE_LIMITS.auth
 } else if (pathname.startsWith('/api/discovery')) {
 rateLimitConfig = RATE_LIMITS.discovery
 } else if (pathname.startsWith('/api/webhooks')) {
 rateLimitConfig = RATE_LIMITS.webhook
 }

 const rateLimitResult = await checkRateLimit(identifier, rateLimitConfig)
 if (!rateLimitResult.success) {
   const retryAfter = Math.max(0, Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
   const responseTimeMs = Date.now() - startTime
   const rateLimitResponse = new NextResponse(
     JSON.stringify({ error: 'Too many requests', retryAfter }),
     {
       status: 429,
       headers: {
         'Content-Type': 'application/json',
         'Retry-After': String(retryAfter),
         'X-RateLimit-Limit': String(rateLimitConfig.maxRequests),
         'X-RateLimit-Remaining': '0',
         'X-RateLimit-Reset': String(rateLimitResult.reset),
         'X-Response-Time-Ms': String(responseTimeMs),
       },
     }
   )
   track(D1Events.API_RATE_LIMIT_HIT, identifier, {
     path: pathname,
     identifier,
     limit_type: rateLimitConfig === RATE_LIMITS.auth ? 'auth' : rateLimitConfig === RATE_LIMITS.webhook ? 'webhook' : rateLimitConfig === RATE_LIMITS.discovery ? 'discovery' : 'api',
   })
   emitUsageEvent(request, { status: 429, headers: rateLimitResponse.headers }).catch(err => {
     logger.error('[Proxy] Failed to emit 429 usage event', err)
   })
   return rateLimitResponse
 }

 // Better Auth guard — skip public API routes (health, webhooks, auth, etc.)
 if (!isPublicApiRoute(pathname)) {
   try {
     const user = await getCurrentUserFromHeaders(request.headers)
     if (!user) {
       const responseTimeMs = Date.now() - startTime
       const unauthorizedResponse = NextResponse.json(
         { error: 'Unauthorized', detail: 'Authentication required' },
         { status: 401 }
       )
       unauthorizedResponse.headers.set('X-Response-Time-Ms', String(responseTimeMs))
       emitUsageEvent(request, { status: 401, headers: unauthorizedResponse.headers }, { tier: 'BASIC' }).catch(err => {
         logger.error('[Proxy] Failed to emit auth failure usage event', err)
       })
       return unauthorizedResponse
     }
     const tier = await getUserTier(user.id)
     request.headers.set('x-user-tier', tier)
   } catch (err) {
     if (err instanceof AuthSystemError) {
       const responseTimeMs = Date.now() - startTime
       const serviceUnavailableResponse = NextResponse.json(
         {
           error: 'Service unavailable',
           detail: 'Authentication service temporarily unavailable. Please retry.',
           retryAfter: 30,
         },
         { status: 503 }
       )
       serviceUnavailableResponse.headers.set('X-Response-Time-Ms', String(responseTimeMs))
       emitUsageEvent(request, { status: 503, headers: serviceUnavailableResponse.headers }, { tier: 'BASIC' }).catch(err => {
         logger.error('[Proxy] Failed to emit auth system error usage event', err)
       })
       return serviceUnavailableResponse
     }
     logger.error('[Proxy] Auth guard unexpected error', err instanceof Error ? err : new Error(String(err)))
     request.headers.set('x-user-tier', 'BASIC')
   }
 } else {
   // Public route — still propagate tier for usage metering
   request.headers.set('x-user-tier', 'BASIC')
 }

 return null
}
