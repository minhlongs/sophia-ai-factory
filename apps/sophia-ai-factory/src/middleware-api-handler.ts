import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/seed/security/rate-limiting-middleware'
import { raasGate, shouldApplyRaasGate } from '@/forest/raas-gate'
import { emitUsageEvent } from '@/forest/usage-metering'
import { logger } from '@/seed/utils/logger-utility'
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret'
import { track } from './lib/signals/track'
import { D1Events } from './lib/signals/d1-event-types'
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
    const responseTimeMs = Date.now() - startTime
    const rateLimitResponse = new NextResponse(
      JSON.stringify({ error: 'Too many requests', retryAfter: rateLimitResult.reset }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.max(0, rateLimitResult.reset - Math.floor(Date.now() / 1000))),
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

  if (shouldApplyRaasGate(pathname)) {
    const raasResult = await raasGate(request)
    if (!raasResult.valid && raasResult.response) {
      const responseTimeMs = Date.now() - startTime
      const forbiddenResponse = raasResult.response
      forbiddenResponse.headers.set('X-Response-Time-Ms', String(responseTimeMs))
      if (raasResult.quotaExceeded) {
        forbiddenResponse.headers.set('X-RateLimit-Remaining', '0')
        if (!forbiddenResponse.headers.has('Retry-After')) {
          const resetTimestamp = Math.floor(Date.now() / 1000) + 3600
          forbiddenResponse.headers.set('Retry-After', String(Math.max(0, resetTimestamp - Math.floor(Date.now() / 1000))))
          forbiddenResponse.headers.set('X-RateLimit-Reset', String(resetTimestamp))
        }
      }
      emitUsageEvent(request, { status: forbiddenResponse.status, headers: forbiddenResponse.headers }, { licenseNonce: undefined, tier: 'BASIC' }).catch(err => {
        logger.error('[Proxy] Failed to emit forbidden usage event', err)
      })
      return forbiddenResponse
    }
    if (raasResult.valid && raasResult.tier) request.headers.set('x-raas-tier', raasResult.tier)
    if (raasResult.valid && raasResult.receipt) request.headers.set('x-raas-receipt', raasResult.receipt)
    if (raasResult.valid && raasResult.quotaRemaining) request.headers.set('x-quota-remaining', JSON.stringify(raasResult.quotaRemaining))
  }

  return null
}
