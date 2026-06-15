---
title: "Phase 5: Rate Limiter Alignment"
description: "Align rate limiter with enriched JWT claims for per-tier rate limiting"
status: pending
priority: P1
effort: 1h
---

# Phase 5: Rate Limiter Alignment

## Overview

Update rate limiter to use enriched JWT claims for per-tier rate limiting and integrate with Cloudflare KV for fast edge enforcement.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/security/rate-limiter.ts` | Modify | Add per-tier rate limits from JWT claims |
| `src/lib/security/rate-limiting-middleware.ts` | Create | Middleware for rate limit enforcement |
| `src/worker/index.ts` | Modify | Worker-side rate limiting with JWT claims |

## Implementation Steps

### Step 5.1: Update Rate Limiter with Tier Support

```typescript
// File: src/lib/security/rate-limiter.ts
// Add tier-based rate limiting:

import { verifyEnrichedJwt, type EnrichedJwtPayload } from '@/lib/auth/enriched-jwt'

/**
 * Rate limit configuration per tier
 */
export const TIER_RATE_LIMITS: Record<string, { requestsPerMinute: number; burstLimit: number }> = {
  BASIC: { requestsPerMinute: 60, burstLimit: 10 },
  PREMIUM: { requestsPerMinute: 200, burstLimit: 30 },
  ENTERPRISE: { requestsPerMinute: 500, burstLimit: 50 },
  MASTER: { requestsPerMinute: 1000, burstLimit: 100 },
}

/**
 * Rate limit result with tier info
 */
export interface TieredRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
  tier?: string
  limit?: number
}

/**
 * Check rate limit using enriched JWT claims
 *
 * @param jwtToken - Enriched JWT from request
 * @param identifier - Additional identifier (IP, endpoint)
 * @returns Rate limit result
 */
export async function checkTieredRateLimit(
  jwtToken: string | null,
  identifier?: string
): Promise<TieredRateLimitResult> {
  // Default rate limit if no JWT
  let tier = 'BASIC'
  let limit = TIER_RATE_LIMITS.BASIC.requestsPerMinute

  // Extract tier from JWT if available
  if (jwtToken) {
    const payload = await verifyEnrichedJwt(jwtToken)
    if (payload) {
      tier = payload.license_tier
      const tierConfig = TIER_RATE_LIMITS[tier]
      if (tierConfig) {
        limit = tierConfig.requestsPerMinute
      }
    }
  }

  // Build identifier
  const rateLimitKey = `rate:${tier}:${identifier || 'global'}:${Math.floor(Date.now() / 60000)}`

  // Check rate limit
  const result = await checkRateLimitWithKey(rateLimitKey, limit)

  return {
    ...result,
    tier,
    limit,
  }
}

/**
 * Internal rate limit check with custom key
 */
async function checkRateLimitWithKey(
  key: string,
  limit: number
): Promise<Omit<TieredRateLimitResult, 'tier' | 'limit'>> {
  const kv = getKvClient()

  if (kv) {
    // Try KV first (fast path for edge)
    const current = await kv.get<number>(key) || 0

    if (current >= limit) {
      const resetAt = (Math.floor(Date.now() / 60000) + 1) * 60000
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      }
    }

    await kv.set(key, current + 1, { expirationTtl: 120 })

    return {
      allowed: true,
      remaining: limit - current - 1,
      resetAt: (Math.floor(Date.now() / 60000) + 1) * 60000,
    }
  }

  // Fallback to SQL-based rate limiting
  return checkRateLimit(key.split(':')[1] || 'default', limit)
}
```

### Step 5.2: Create Rate Limiting Middleware

```typescript
// File: src/lib/security/rate-limiting-middleware.ts

/**
 * Rate Limiting Middleware
 *
 * Applies tier-based rate limiting using enriched JWT claims.
 * Returns 429 Too Many Requests when limit exceeded.
 *
 * @module security/rate-limiting-middleware
 */

import { checkTieredRateLimit, type TieredRateLimitResult } from './rate-limiter'
import { logger } from '@/lib/utils/logger-utility'

/**
 * Rate limit middleware response
 */
export interface RateLimitMiddlewareResult {
  allowed: boolean
  response?: Response
  result?: TieredRateLimitResult
}

/**
 * Apply rate limiting to request
 *
 * @param request - Request object
 * @returns Result with response if rate limited
 */
export async function applyRateLimit(
  request: Request
): Promise<RateLimitMiddlewareResult> {
  // Extract JWT from headers
  const jwtToken = request.headers.get('x-raas-jwt') ||
                   request.headers.get('Authorization')?.replace('Bearer ', '')

  // Extract identifier (IP or API key ID)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const apiKeyId = request.headers.get('x-api-key-id')
  const identifier = apiKeyId || ip

  // Check rate limit
  const result = await checkTieredRateLimit(jwtToken, identifier)

  if (!result.allowed) {
    logger.warn('[Rate Limiter] Rate limit exceeded', {
      tier: result.tier,
      limit: result.limit,
      identifier,
    })

    return {
      allowed: false,
      response: new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'Retry-After': result.retryAfter?.toString() || '60',
          'X-RateLimit-Limit': result.limit?.toString() || '60',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
        },
      }),
    }
  }

  // Attach rate limit headers to request for downstream use
  request.headers.set('x-ratelimit-remaining', result.remaining.toString())
  request.headers.set('x-ratelimit-reset', new Date(result.resetAt).toISOString())

  return {
    allowed: true,
    result,
  }
}

/**
 * Create rate limit headers for response
 */
export function addRateLimitHeaders(
  response: Response,
  result: TieredLimitResult
): Response {
  const newResponse = new Response(response.body, response)

  newResponse.headers.set('X-RateLimit-Limit', result.limit?.toString() || '60')
  newResponse.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  newResponse.headers.set('X-RateLimit-Reset', new Date(result.resetAt).toISOString())

  return newResponse
}
```

### Step 5.3: Update Cloudflare Worker

```typescript
// File: src/worker/index.ts
// Add rate limiting to worker fetch handler:

import { checkTieredRateLimit } from '../lib/security/rate-limiter'
import { verifyEnrichedJwt } from '../lib/auth/enriched-jwt'

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Extract JWT
    const authHeader = request.headers.get('Authorization')
    const jwtToken = authHeader?.replace('Bearer ', '')

    if (!jwtToken) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Verify JWT and extract claims
    const claims = await verifyEnrichedJwt(jwtToken)
    if (!claims) {
      return new Response('Invalid token', { status: 401 })
    }

    // Rate limit check using KV (edge-fast)
    const tier = claims.license_tier
    const limit = claims.quota.hourlyCredits // Use hourly credits as rate limit
    const minuteWindow = Math.floor(Date.now() / 60000)
    const rateLimitKey = `rate:${claims.license_nonce}:${minuteWindow}`

    const currentCount = await env.KV_KV.get<number>(rateLimitKey) || 0

    if (currentCount >= limit) {
      return new Response('Rate limited', {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
        },
      })
    }

    // Increment counter
    await env.KV_KV.set(rateLimitKey, currentCount + 1, { expirationTtl: 120 })

    // Queue usage event with feature context
    await env.USAGE_QUEUE.send({
      userId: claims.sub,
      licenseNonce: claims.license_nonce,
      tier: claims.license_tier,
      timestamp: Date.now(),
    })

    // Proceed to handler
    return handleRequest(request, claims)
  },
}
```

### Step 5.4: Update Middleware Integration

```typescript
// File: src/middleware.ts
// Add rate limiting to middleware chain:

import { applyRateLimit } from '@/lib/security/rate-limiting-middleware'

export async function middleware(request: Request): Promise<Response> {
  // ... existing auth/routing logic ...

  // Apply rate limiting AFTER RaaS gate (so we have JWT)
  if (shouldApplyRateLimit(pathname)) {
    const rateLimitResult = await applyRateLimit(request)

    if (!rateLimitResult.allowed && rateLimitResult.response) {
      return rateLimitResult.response
    }
  }

  // ... continue to handler ...
}

function shouldApplyRateLimit(pathname: string): boolean {
  // Apply to API routes except health/check endpoints
  if (pathname.startsWith('/api/')) {
    return !pathname.startsWith('/api/health') &&
           !pathname.startsWith('/api/webhooks/')
  }
  return false
}
```

## Verification

```bash
# Test tiered rate limiting
npm test -- src/lib/security/rate-limiter.test.ts

# Test middleware integration
npm test -- src/lib/security/rate-limiting-middleware.test.ts

# Manual test: Make 100 rapid requests and verify 429 response
for i in {1..100}; do
  curl -sI http://localhost:3000/api/test \
    -H "Authorization: Bearer $JWT" \
    | head -1
done
```

## Success Criteria

- [ ] Per-tier rate limits configured (BASIC/PREMIUM/ENTERPRISE/MASTER)
- [ ] Rate limiter reads tier from enriched JWT
- [ ] Cloudflare KV used for edge-fast rate limiting
- [ ] 429 responses include proper headers (Retry-After, X-RateLimit-*)
- [ ] Rate limit middleware integrates with existing middleware chain

## Unresolved Questions

1. Should rate limits be configurable per tenant/license (custom quotas)?
2. Should we implement sliding window vs. fixed window rate limiting?
