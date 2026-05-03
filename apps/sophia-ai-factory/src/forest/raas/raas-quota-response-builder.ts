/**
 * RaaS Quota Response Builder
 *
 * Builds NextResponse objects for quota enforcement outcomes.
 * Extracted from raas-rate-limiter.ts to keep it < 200 lines.
 * Must NOT import from raas-rate-limiter.ts (prevents circular imports).
 */

import { NextResponse } from 'next/server'

interface QuotaExceededPayload {
  error: string
  code: string
  message: string
  exceeded: {
    type: string
    limit?: number
  }
  remaining: unknown
  retryAfter?: number
  upgradeUrl?: string
  polarCustomerId?: string
  dunningState?: string
  dunningReason?: string
}

/**
 * Build 429 response for quota exceeded
 */
export function buildQuotaExceededResponse(denied: QuotaExceededPayload): NextResponse {
  return NextResponse.json(
    {
      error: denied.error || 'quota_exceeded',
      code: denied.code || 'QUOTA_EXCEEDED',
      message: denied.message || 'Usage limit exceeded',
      exceeded: denied.exceeded,
      remaining: denied.remaining,
      retry_after: denied.retryAfter,
      upgrade_url: denied.upgradeUrl,
      polar_customer_id: denied.polarCustomerId,
      dunning_state: denied.dunningState,
      dunning_reason: denied.dunningReason,
    },
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(denied.retryAfter || 3600),
        'X-RateLimit-Limit': String(denied.exceeded.limit || 0),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + (denied.retryAfter || 3600)),
      },
    }
  )
}

/**
 * Build 503 response for quota check failure (fail-closed mode)
 */
export function buildQuotaErrorResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Quota check failed',
      message: 'Unable to verify quota. Please try again later.',
      code: 'quota_check_error',
    },
    {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '30',
      },
    }
  )
}
