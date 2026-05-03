/**
 * Quota Enforcer - Hard Usage Limits
 * Runs AFTER JWT/mk_ authentication, BEFORE model inference/execution.
 * Returns 429 with quota_exceeded code when limit exceeded.
 * Local DB is source of truth, updated by NOWPayments IPN.
 * @module quota/quota-enforcer
 */

import { logger } from '@/seed/utils/logger-utility'
import { checkQuotaWithOverage, DEFAULT_CONFIG } from './quota-checker'
import type { QuotaCheckContext, EnhancedQuotaCheckResult } from './quota-checker'
import { invalidateQuotaCache } from './quota-checker'
import { invalidateRealTimeCache } from '@/lib/usage-metering/realtime-tracker'
import { canAccessApi } from '@/lib/billing/dunning-workflow'
import { createQuotaExceededResponse, createDunningBlockResponse } from './quota-enforcer-response'

export type { QuotaExceededResponse } from './quota-enforcer-response'
export { getQuotaStatus, getUserIdFromLicense } from './quota-enforcer-status'

// Phase 11: video quota enforcement
export { checkVideoQuota, debitVideoQuota, QuotaExceededError } from './quota-enforcer-video'

export async function enforceQuota(
  context: QuotaCheckContext,
  config = DEFAULT_CONFIG
): Promise<{ allowed: true; result: EnhancedQuotaCheckResult } | { allowed: false; response: ReturnType<typeof createQuotaExceededResponse> }> {
  const { licenseNonce, polarCustomerId } = context

  const dunningCheck = await canAccessApi(licenseNonce)
  if (!dunningCheck.allowed) {
    logger.warn('[Quota Enforcer] Block - dunning state', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      dunningState: dunningCheck.state,
      reason: dunningCheck.reason,
    })
    return { allowed: false, response: createDunningBlockResponse(dunningCheck) }
  }

  const quotaResult = await checkQuotaWithOverage(context, config)

  if (!quotaResult.allowed && quotaResult.exceeded) {
    const exceededResponse = createQuotaExceededResponse(quotaResult, context, polarCustomerId)
    logger.warn('[Quota Enforcer] Hard block - quota exceeded', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      exceededType: quotaResult.exceeded.type,
      retryAfter: exceededResponse.retryAfter,
    })
    return { allowed: false, response: exceededResponse }
  }

  await invalidateQuotaCache(context.userId, licenseNonce)
  await invalidateRealTimeCache(context.userId, licenseNonce)

  if (quotaResult.warningThreshold) {
    logger.warn('[Quota Enforcer] Soft warning - approaching quota', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      remaining: quotaResult.remaining,
    })
  }

  return { allowed: true, result: quotaResult }
}
