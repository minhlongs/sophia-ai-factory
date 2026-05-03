/**
 * RaaS Auth Gate - Main middleware entry point
 *
 * Orchestrates license key validation, audit logging, and quota enforcement.
 * Use this function in middleware.ts and individual API route handlers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { logValidationWithReceipt } from '@/lib/audit/logger/audit-writer'
import { serializeReceiptForHeader } from '@/lib/audit/logger/audit-query'
import { extractLicenseKey, validateLicenseKey, createForbiddenResponse } from './raas-validation'
import { enforceRaasQuota } from './raas-rate-limiter'

/**
 * RaaS Gate middleware return type
 */
export interface RaasGateResult {
  valid: boolean
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

/**
 * RaaS Gate Middleware
 *
 * Use in middleware.ts for /api/* routes or in individual API route handlers.
 *
 * @param request - Next.js request object
 * @returns Validation result with optional response and receipt
 */
export async function raasGate(request: NextRequest): Promise<RaasGateResult> {
  const licenseKey = extractLicenseKey(request)
  const result = await validateLicenseKey(licenseKey)

  if (!result.valid) {
    // Log failed validation attempt
    await logValidationWithReceipt({
      nonce: licenseKey || 'unknown',
      isValid: false,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'unknown',
    })

    logger.info('[RaaS Gate] Validation attempt', {
      path: request.nextUrl.pathname,
      valid: result.valid,
      reason: result.reason,
    })

    return {
      valid: false,
      response: createForbiddenResponse(result.reason!),
    }
  }

  // Log successful validation with receipt
  const receipt = await logValidationWithReceipt({
    nonce: licenseKey!,
    isValid: true,
    userId: request.headers.get('x-logged-in-user-id') || undefined,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    tier: result.tier,
  })

  logger.info('[RaaS Gate] Validation attempt', {
    path: request.nextUrl.pathname,
    valid: result.valid,
    reason: result.reason,
    hasReceipt: !!receipt,
  })

  // QUOTA ENFORCEMENT: Real-time quota check with circuit breaker
  if (result.valid && licenseKey) {
    const quotaResult = await enforceRaasQuota(request, licenseKey, result.tier, receipt)

    if (!quotaResult.allowed) {
      return {
        valid: false,
        response: quotaResult.response,
        tier: result.tier,
        quotaExceeded: quotaResult.quotaExceeded,
      }
    }

    return {
      valid: true,
      tier: quotaResult.tier ?? result.tier,
      receipt: quotaResult.receipt,
      quotaWarning: quotaResult.quotaWarning,
      quotaRemaining: quotaResult.quotaRemaining,
    }
  }

  return {
    valid: true,
    tier: result.tier,
    receipt: receipt ? serializeReceiptForHeader(receipt) : undefined,
  }
}

export default raasGate
