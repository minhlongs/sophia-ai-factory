/**
 * RaaS Rate Limiter - Quota enforcement and circuit breaker logic
 *
 * Enforces per-license quota limits with circuit breaker protection,
 * emergency bypass detection, and real-time violation alerting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { toError, getErrorMessage } from '@/seed/utils/to-error'
import { checkQuotaWithOverage, DEFAULT_CONFIG } from '@/forest/quota/quota-checker'
import { enforceQuota } from '@/forest/quota/quota-enforcer'
import { createServerClient } from '@/seed/db/client'
import { hasEmergencyBypass, recordCircuitFailure, recordCircuitSuccess } from '@/forest/usage-metering/realtime-tracker'
import { logViolationAndAlert } from '@/forest/alerts/realtime-alert-service'
import { sha256 } from '@/tree/audit/crypto-utils'
import { serializeReceiptForHeader } from '@/tree/audit/logger/audit-query'
import type { ComplianceReceipt } from '@/tree/audit/compliance-receipt'
import type { Tier } from '@/seed/types'
import { buildQuotaExceededResponse, buildQuotaErrorResponse } from './raas-quota-response-builder'

const VALID_TIERS: readonly Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const

function narrowTier(value: string): Tier {
  return (VALID_TIERS as readonly string[]).includes(value) ? (value as Tier) : 'BASIC'
}

/** Quota enforcement result returned to raas-auth-gate */
export interface QuotaEnforcementResult {
  allowed: boolean
  response?: NextResponse
  tier?: string
  receipt?: string
  quotaWarning?: boolean
  quotaExceeded?: boolean
  quotaRemaining?: {
    dailyCredits: number
    hourlyCredits: number
    dailyRequests: number
    monthlyCredits: number
  }
}

/** Enforce quota for a validated license key */
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
      .select('nonce, tier')
      .eq('key_hash', keyHash)
      .single()

    const license = licenseRaw as { nonce: string; tier: string } | null

    if (!license) {
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
    }, DEFAULT_CONFIG)

    if (!quotaResult.allowed) {
      await recordCircuitSuccess(license.nonce)

      const deniedResponse = quotaResult.response
      const typedTier = narrowTier(tier)

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
        response: buildQuotaExceededResponse(deniedResponse),
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

    request.headers.set('x-quota-remaining', JSON.stringify(allowedResult?.remaining))
    return {
      allowed: true,
      tier: resultTier,
      receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error)
    logger.error('[RaaS Gate] Quota check error', toError(error))

    if (licenseNonceForError) {
      await recordCircuitFailure(licenseNonceForError, error instanceof Error ? error : new Error(errorMessage))
    }

    const failClosed = DEFAULT_CONFIG.failClosed
    if (failClosed) {
      logger.warn('[RaaS Gate] Fail-closed mode: blocking due to quota check failure')
      return {
        allowed: false,
        response: buildQuotaErrorResponse(),
        tier: resultTier,
      }
    }

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
