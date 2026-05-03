/**
 * Server-side tier quota enforcement.
 *
 * Reads the user's subscription tier and checks monthly video usage
 * against the tier limit defined in lib/quota/video-quota.ts.
 *
 * Returns { allowed, used, limit, resetsAt, reason? } so callers
 * can return 429 with retry-after metadata.
 *
 * P0.2: Centralizes server-side quota check that was previously only
 * enforced in the UI / dashboard tier guard.
 *
 * @module lib/auth/enforce-tier-quota
 */

import { getUserTier } from '@/lib/db/get-user-tier'
import { checkVideoQuota, VIDEO_QUOTA_BY_TIER } from '@/lib/quota/video-quota'

export interface TierQuotaResult {
  allowed: boolean
  used: number
  limit: number
  /** ISO timestamp when the quota resets (start of next month UTC) */
  resetsAt: string
  /** Human-readable reason when allowed=false */
  reason?: string
}

/**
 * Check whether `userId` is allowed to generate another video this month.
 *
 * Reads tier from D1 subscriptions table (falls back to BASIC on miss).
 * BASIC limit = 0 (feature gated to PREMIUM+; handled via 402 in route).
 * One-time bundle credits are NOT subject to this quota — they have their
 * own credits_remaining column tracked separately.
 *
 * @param userId - The authenticated user's ID
 * @returns TierQuotaResult
 */
export async function checkTierQuota(userId: string): Promise<TierQuotaResult> {
  const tier = await getUserTier(userId)
  const limit = VIDEO_QUOTA_BY_TIER[tier] ?? 0

  if (limit === 0) {
    const resetsAt = nextMonthStart()
    return {
      allowed: false,
      used: 0,
      limit: 0,
      resetsAt,
      reason: `Tier ${tier} does not include video generation. Upgrade to PREMIUM or higher.`,
    }
  }

  const status = await checkVideoQuota(userId, tier)
  return {
    allowed: status.allowed,
    used: status.used,
    limit: status.limit,
    resetsAt: status.resetAt,
    reason: status.allowed
      ? undefined
      : `Monthly video limit of ${status.limit} reached for tier ${tier}.`,
  }
}

function nextMonthStart(): string {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return next.toISOString()
}
