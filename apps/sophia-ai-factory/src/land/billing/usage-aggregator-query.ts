/**
 * DB aggregation query for Usage Aggregator
 * @module billing/usage-aggregator-query
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import type { Tier } from '@/seed/types'
import { QUOTA_LIMITS } from '@/seed/config/quota-limits'
import { getCurrentBillingPeriod } from './usage-aggregator-types'
import type { UsageSummary } from './usage-aggregator-types'

export async function aggregateUsageForLicense(
  licenseNonce: string,
  periodStart?: number,
  periodEnd?: number,
): Promise<UsageSummary | null> {
  const db = createServerClient()
  try {
    const { data: license, error: licenseError } = await db
      .from('raas_licenses')
      .select('nonce, tier, created_by')
      .eq('nonce', licenseNonce)
      .single() as { data: { nonce: string; tier: string; created_by: string } | null; error: unknown }

    if (licenseError || !license) {
      logger.debug('[Usage Aggregator] License not found', { licenseNonce: licenseNonce.slice(0, 8) })
      return null
    }

    const userId = license.created_by
    const tier = (license.tier || 'BASIC').toUpperCase() as Tier

    const { periodStart: defaultStart, periodEnd: defaultEnd } = getCurrentBillingPeriod()
    const startTs = periodStart || defaultStart
    const endTs = periodEnd || defaultEnd
    const limits = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC

    const now = Math.floor(Date.now() / 1000)
    const hourStart = Math.floor(now / 3600) * 3600
    const dayStart = Math.floor(now / 86400) * 86400

    const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
      db.from('usage_events').select('credits_used')
        .eq('user_id', userId).eq('license_nonce', licenseNonce)
        .gte('created_at', hourStart).lt('created_at', hourStart + 3600),
      db.from('usage_events').select('credits_used')
        .eq('user_id', userId).eq('license_nonce', licenseNonce)
        .gte('created_at', dayStart).lt('created_at', dayStart + 86400),
      db.from('usage_events').select('credits_used')
        .eq('user_id', userId).eq('license_nonce', licenseNonce)
        .gte('created_at', startTs).lte('created_at', endTs),
    ])

    const hourlyCredits = (hourlyResult.data as { credits_used: number }[] | null)?.reduce((s, r) => s + (r.credits_used || 0), 0) || 0
    const dailyCredits = (dailyResult.data as { credits_used: number }[] | null)?.reduce((s, r) => s + (r.credits_used || 0), 0) || 0
    const monthlyCredits = (monthlyResult.data as { credits_used: number }[] | null)?.reduce((s, r) => s + (r.credits_used || 0), 0) || 0
    const dailyRequests = dailyResult.data?.length || 0

    const hourlyOverage = Math.max(0, hourlyCredits - limits.hourlyCredits)
    const dailyOverage = Math.max(0, dailyCredits - limits.dailyCredits)
    const monthlyOverage = Math.max(0, monthlyCredits - limits.monthlyCredits)
    const dailyRequestOverage = Math.max(0, dailyRequests - limits.dailyRequests)

    const hourlyPercentage = (hourlyCredits / limits.hourlyCredits) * 100
    const dailyPercentage = (dailyCredits / limits.dailyCredits) * 100
    const monthlyPercentage = (monthlyCredits / limits.monthlyCredits) * 100

    const maxPercent = Math.max(hourlyPercentage, dailyPercentage, monthlyPercentage)
    let status: 'ok' | 'warning' | 'critical' | 'overage' = 'ok'
    if (hourlyOverage > 0 || dailyOverage > 0 || monthlyOverage > 0 || dailyRequestOverage > 0) {
      status = 'overage'
    } else if (maxPercent >= 100) {
      status = 'critical'
    } else if (maxPercent >= 80) {
      status = 'warning'
    }

    logger.info('[Usage Aggregator] Aggregated usage for license', {
      licenseNonce: licenseNonce.slice(0, 8) + '...', tier, status, monthlyUsage: monthlyCredits, monthlyLimit: limits.monthlyCredits,
    })

    return {
      userId, licenseNonce, tier,
      periodStart: defaultStart, periodEnd: defaultEnd,
      hourlyCredits, hourlyLimit: limits.hourlyCredits, hourlyOverage,
      dailyCredits, dailyLimit: limits.dailyCredits, dailyOverage,
      monthlyCredits, monthlyLimit: limits.monthlyCredits, monthlyOverage,
      dailyRequests, dailyRequestLimit: limits.dailyRequests, dailyRequestOverage,
      hourlyPercentage, dailyPercentage, monthlyPercentage, status,
    }
  } catch (error) {
    logger.error('[Usage Aggregator] Failed to aggregate usage', toError(error))
    return null
  }
}
