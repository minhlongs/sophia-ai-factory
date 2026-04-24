/**
 * RaaS Rate Limiter - Quota enforcement and circuit breaker logic
 *
 * Enforces per-license quota limits with circuit breaker protection,
 * emergency bypass detection, and real-time violation alerting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'
import { checkQuotaWithOverage, DEFAULT_CONFIG } from '@/lib/quota/quota-checker'
import { enforceQuota } from '@/lib/quota/quota-enforcer'
import { createServerClient } from '@/lib/db/client'
import { hasEmergencyBypass, recordCircuitFailure, recordCircuitSuccess } from '@/lib/usage-metering/realtime-tracker'
import { logViolationAndAlert } from '@/lib/alerts/realtime-alert-service'
import { sha256 } from '@/lib/audit/crypto-utils'
import { serializeReceiptForHeader } from '@/lib/audit/logger/audit-query'
import type { ComplianceReceipt } from '@/lib/audit/compliance-receipt'
import type { Tier } from '@/types'

const VALID_TIERS: readonly Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const

function narrowTier(value: string): Tier {
  return (VALID_TIERS as readonly string[]).includes(value) ? (value as Tier) : 'BASIC'
}

/**
 * Quota enforcement result returned to raas-auth-gate
 */
export interface QuotaEnforcementResult {
  /** Whether the request is allowed to proceed */
  allowed: boolean
  /** 429 response to return if quota exceeded */
  response?: NextResponse
  /** Tier from license record */
  tier?: string
  /** Serialized receipt for X-Receipt header */
  receipt?: string
  /** Whether quota warning threshold reached */
  quotaWarning?: boolean
  /** Whether quota was exceeded */
  quotaExceeded?: boolean
  /** Remaining quota metrics */
  quotaRemaining?: {
    dailyCredits: number
    hourlyCredits: number
    dailyRequests: number
    monthlyCredits: number
  }
}

/**
 * Enforce quota for a validated license key
 *
 * @param request - Incoming Next.js request
 * @param licenseKey - Validated license key
 * @param resultTier - Tier from HMAC validation
 * @param receipt - Compliance receipt from audit logger (or null)
 * @returns Quota enforcement result
 */
export async function enforceRaasQuota(
  request: NextRequest,
  licenseKey: string,
  resultTier: string | undefined,
  receipt: ComplianceReceipt | null
): Promise<QuotaEnforcementResult> {
  let licenseNonceForError: string | undefined

  try {
    const db = createServerClient()
    const keyHash = sha256(licenseKey)

    const { data: licenseRaw } = await db
      .from('raas_licenses')
      .select('nonce, tier, polar_customer_id')
      .eq('key_hash', keyHash)
      .single()

    const license = licenseRaw as { nonce: string; tier: string; polar_customer_id: string | null } | null

    if (!license) {
      // No license record — allow but skip quota
      return {
        allowed: true,
        tier: resultTier,
        receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
      }
    }

    licenseNonceForError = license.nonce

    const { data: licenseDataRaw } = await db
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', license.nonce)
      .single()

    const licenseData = licenseDataRaw as { created_by: string } | null
    const userId = licenseData?.created_by || 'anonymous'
    const tier = (license.tier || 'BASIC').toUpperCase()

    // Emergency bypass (admin override)
    if (hasEmergencyBypass(request.headers)) {
      logger.warn('[RaaS Gate] Emergency bypass activated', {
        userId,
        licenseNonce: license.nonce.slice(0, 8) + '...',
        path: request.nextUrl.pathname,
      })
      return {
        allowed: true,
        tier: resultTier,
        receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
        quotaWarning: false,
      }
    }

    // Enforce quota with circuit breaker
    const quotaResult = await enforceQuota({
      userId,
      licenseNonce: license.nonce,
      tier,
      requestedCredits: 1,
      endpoint: request.nextUrl.pathname,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      polarCustomerId: license.polar_customer_id || undefined,
    }, DEFAULT_CONFIG)

    if (!quotaResult.allowed) {
      await recordCircuitSuccess(license.nonce)

      const deniedResponse = quotaResult.response
      const typedTier = narrowTier(tier)

      // Log violation and create real-time alert
      await logViolationAndAlert({
        userId,
        licenseNonce: license.nonce,
        tier: typedTier,
        type: 'quota_exceeded',
        severity: deniedResponse.exceeded.type === 'hourly_credits' ? 'critical' : 'high',
        endpoint: request.nextUrl.pathname,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: {
          exceeded: deniedResponse.exceeded,
          remaining: deniedResponse.remaining,
          retryAfter: deniedResponse.retryAfter,
        },
      }).catch(err => {
        logger.error('[RaaS Gate] Failed to log violation and alert', toError(err))
      })

      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: deniedResponse.code || 'quota_exceeded',
            code: deniedResponse.code || 'QUOTA_EXCEEDED',
            message: deniedResponse.message || 'Usage limit exceeded',
            exceeded: deniedResponse.exceeded,
            remaining: deniedResponse.remaining,
            retry_after: deniedResponse.retryAfter,
            upgrade_url: deniedResponse.upgradeUrl,
            polar_customer_id: deniedResponse.polarCustomerId,
            dunning_state: deniedResponse.dunningState,
            dunning_reason: deniedResponse.dunningReason,
          },
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(deniedResponse.retryAfter || 3600),
              'X-RateLimit-Limit': String(deniedResponse.exceeded.limit || 0),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + (deniedResponse.retryAfter || 3600)),
            },
          }
        ),
        tier: resultTier,
        quotaExceeded: true,
      }
    }

    await recordCircuitSuccess(license.nonce)

    const allowedResult = quotaResult.result

    if (allowedResult?.warningThreshold) {
      logger.warn('[RaaS Gate] Quota warning threshold reached', {
        userId,
        licenseNonce: license.nonce.slice(0, 8) + '...',
        remaining: allowedResult.remaining,
      })
      return {
        allowed: true,
        tier: resultTier,
        receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
        quotaWarning: true,
        quotaRemaining: allowedResult.remaining,
      }
    }

    // Store remaining for X-RateLimit headers on successful requests
    request.headers.set('x-quota-remaining', JSON.stringify(allowedResult?.remaining))
    return {
      allowed: true,
      tier: resultTier,
      receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[RaaS Gate] Quota check error', toError(error))

    if (licenseNonceForError) {
      await recordCircuitFailure(licenseNonceForError, error instanceof Error ? error : new Error(errorMessage))
    }

    const failClosed = process.env.QUOTA_FAIL_CLOSED === 'true'
    if (failClosed) {
      logger.warn('[RaaS Gate] Fail-closed mode: blocking due to quota check failure')
      return {
        allowed: false,
        response: NextResponse.json(
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
        ),
        tier: resultTier,
      }
    }

    // Fail-open: allow request if quota check fails
    logger.warn('[RaaS Gate] Fail-open mode: allowing request despite quota check failure')
    return {
      allowed: true,
      tier: resultTier,
      receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
    }
  }
}

// Re-export for convenience — consumers import quota helpers via raas barrel
export { checkQuotaWithOverage, DEFAULT_CONFIG }
