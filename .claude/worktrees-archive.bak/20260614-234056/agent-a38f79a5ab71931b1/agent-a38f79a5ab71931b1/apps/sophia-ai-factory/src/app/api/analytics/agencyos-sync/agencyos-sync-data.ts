/**
 * Data fetchers for AgencyOS Analytics Sync
 * @module api/analytics/agencyos-sync/agencyos-sync-data
 */

import { createServerClient } from '@/seed/db/client'

export async function fetchQuotaUsage(licenseNonce: string, startDate: number, endDate: number): Promise<{ totalCreditsUsed: number; hourlyCredits: number; dailyCredits: number; monthlyCredits: number; requestCount: number }> {
  const db = createServerClient()
  const { data: usageEvents } = await db.from('usage_events').select('credits_used, created_at').eq('license_nonce', licenseNonce).gte('created_at', startDate).lte('created_at', endDate)
  if (!usageEvents || usageEvents.length === 0) return { totalCreditsUsed: 0, hourlyCredits: 0, dailyCredits: 0, monthlyCredits: 0, requestCount: 0 }

  const now = Math.floor(Date.now() / 1000)
  const hourStart = Math.floor(now / 3600) * 3600
  const dayStart = Math.floor(now / 86400) * 86400
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000)

  let hourlyCredits = 0, dailyCredits = 0, monthlyCredits = 0
  for (const event of usageEvents) {
    const credits = (event.credits_used as number) || 0
    const ts = event.created_at as number
    if (ts >= hourStart) hourlyCredits += credits
    if (ts >= dayStart) dailyCredits += credits
    if (ts >= monthStart) monthlyCredits += credits
  }

  return {
    totalCreditsUsed: usageEvents.reduce((sum, e) => sum + ((e.credits_used as number) || 0), 0),
    hourlyCredits, dailyCredits, monthlyCredits,
    requestCount: usageEvents.length,
  }
}

export async function fetchOverageEvents(licenseNonce: string, startDate: number, endDate: number): Promise<{ totalOverageCredits: number; totalCharges: number; violations: Array<{ timestamp: string; type: string; exceededBy: number }> }> {
  const db = createServerClient()
  const { data: overageEvents } = await db.from('overage_events').select('exceeded_type, exceeded_by, created_at').eq('license_nonce', licenseNonce).gte('created_at', startDate).lte('created_at', endDate).order('created_at', { ascending: true })
  if (!overageEvents || overageEvents.length === 0) return { totalOverageCredits: 0, totalCharges: 0, violations: [] }

  const totalOverageCredits = overageEvents.reduce((sum, e) => sum + ((e.exceeded_by as number) || 0), 0)
  return {
    totalOverageCredits,
    totalCharges: totalOverageCredits * 0.05,
    violations: overageEvents.map(e => ({ timestamp: new Date((e.created_at as number) * 1000).toISOString(), type: (e.exceeded_type as string) || 'unknown', exceededBy: (e.exceeded_by as number) || 0 })),
  }
}

export async function fetchTierHistory(licenseNonce: string): Promise<Array<{ tier: string; startDate: string }>> {
  const db = createServerClient()
  const { data: license } = await db.from('raas_licenses').select('tier, created_at').eq('nonce', licenseNonce).single()
  if (!license) return []
  return [{ tier: (license.tier as string) || 'BASIC', startDate: new Date((license.created_at as number) * 1000).toISOString() }]
}
