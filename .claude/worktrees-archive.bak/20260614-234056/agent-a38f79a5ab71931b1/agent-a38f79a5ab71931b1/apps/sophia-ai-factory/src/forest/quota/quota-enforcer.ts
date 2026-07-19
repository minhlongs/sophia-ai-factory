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
import { canAccessApi } from '@/land/billing/dunning-workflow'
import { createQuotaExceededResponse, createDunningBlockResponse } from './quota-enforcer-response'
import {
 checkVideoQuota as atomicCheckVideoQuota,
 reserveVideoSlot as atomicReserveVideoSlot,
 VIDEO_QUOTA_BY_TIER,
} from './video-quota'

export type { QuotaExceededResponse } from './quota-enforcer-response'
export { getQuotaStatus, getUserIdFromLicense } from './quota-enforcer-status'

// Phase 11: video quota enforcement — migrated to atomic video-quota.ts
// Compatibility wrappers preserve old API (throw on exceed) over new atomic API (return status)

/** @deprecated Use atomicCheckVideoQuota from video-quota.ts directly. Throws QuotaExceededError when limit reached. */
export async function checkVideoQuota(tenantId: string, tier: string): Promise<void> {
 const status = await atomicCheckVideoQuota(tenantId, tier)
 if (!status.allowed) {
  throw new QuotaExceededError(
   `Video quota exceeded: ${status.used}/${status.limit} videos this month.`,
   tier,
   status.limit,
   status.used,
  )
 }
}

/** @deprecated Use atomicReserveVideoSlot from video-quota.ts for atomic reservation. */
export async function debitVideoQuota(tenantId: string): Promise<void> {
 await atomicReserveVideoSlot(tenantId, VIDEO_QUOTA_BY_TIER['BASIC'] ?? 0)
}

export class QuotaExceededError extends Error {
 public readonly status = 429;

 constructor(
  message: string,
  public readonly tier: string,
  public readonly limit: number,
  public readonly used: number,
 ) {
  super(message);
  this.name = 'QuotaExceededError';
 }
}

export async function enforceQuota(
  context: QuotaCheckContext,
  config = DEFAULT_CONFIG
): Promise<{ allowed: true; result: EnhancedQuotaCheckResult } | { allowed: false; response: ReturnType<typeof createQuotaExceededResponse> }> {
  const { licenseNonce } = context

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
    const exceededResponse = createQuotaExceededResponse(quotaResult, context)
    logger.warn('[Quota Enforcer] Hard block - quota exceeded', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      exceededType: quotaResult.exceeded.type,
      retryAfter: exceededResponse.retryAfter,
    })
    return { allowed: false, response: exceededResponse }
  }

  // NOTE: Cache invalidation intentionally removed from success path (fix #R2-16).
  // Invalidating on every allowed request caused 2 KV writes per request that
  // immediately destroyed the cache just read. Cache is now invalidated only
  // in tracker.ts after a usage event is actually written to D1.

  if (quotaResult.warningThreshold) {
    logger.warn('[Quota Enforcer] Soft warning - approaching quota', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      remaining: quotaResult.remaining,
    })
  }

  return { allowed: true, result: quotaResult }
}
