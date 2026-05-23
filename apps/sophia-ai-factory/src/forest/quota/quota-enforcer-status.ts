/**
 * Quota status queries — real-time usage aggregation from local DB
 * @module quota/quota-enforcer-status
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getEffectiveQuotaLimits } from './quota-checker'

interface UsageEventRow { credits_used: number }

export async function getUserIdFromLicense(licenseNonce: string): Promise<string | null> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', licenseNonce)
      .single() as { data: { created_by: string } | null; error: unknown }
    return data?.created_by || null
  } catch (error) {
    logger.error('[Quota Enforcer] Error getting user ID from license', toError(error))
    return null
  }
}

export async function getQuotaStatus(
  userId: string,
  licenseNonce: string,
  tier: string,
): Promise<{
  usage: { hourly: number; daily: number; monthly: number; requests: number }
  limits: { hourlyCredits: number; dailyCredits: number; monthlyCredits: number; dailyRequests: number }
  percentages: { hourly: number; daily: number; monthly: number }
  status: 'ok' | 'warning' | 'critical'
}> {
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier)
  const db = createServerClient()
  const now = Math.floor(Date.now() / 1000)
  const hourStart = Math.floor(now / 3600) * 3600
  const dayStart = Math.floor(now / 86400) * 86400
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000)

  const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
    db.from('usage_events').select('credits_used').eq('user_id', userId).eq('license_nonce', licenseNonce).gte('created_at', hourStart),
    db.from('usage_events').select('credits_used').eq('user_id', userId).eq('license_nonce', licenseNonce).gte('created_at', dayStart),
    db.from('usage_events').select('credits_used').eq('user_id', userId).eq('license_nonce', licenseNonce).gte('created_at', monthStart),
  ])

  const usage = {
    hourly: (hourlyResult.data as unknown as UsageEventRow[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0,
    daily: (dailyResult.data as unknown as UsageEventRow[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0,
    monthly: (monthlyResult.data as unknown as UsageEventRow[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0,
    requests: dailyResult.data?.length || 0,
  }

  const percentages = {
    hourly: (usage.hourly / limits.hourlyCredits) * 100,
    daily: (usage.daily / limits.dailyCredits) * 100,
    monthly: (usage.monthly / limits.monthlyCredits) * 100,
  }

  const maxPercent = Math.max(percentages.hourly, percentages.daily, percentages.monthly)
  const status: 'ok' | 'warning' | 'critical' = maxPercent >= 100 ? 'critical' : maxPercent >= 80 ? 'warning' : 'ok'

  return { usage, limits, percentages, status }
}
