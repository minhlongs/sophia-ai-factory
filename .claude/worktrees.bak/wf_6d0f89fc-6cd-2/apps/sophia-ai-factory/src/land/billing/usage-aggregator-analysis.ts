/**
 * Overage detection, forecast, and pricing analysis for Usage Aggregator
 * @module billing/usage-aggregator-analysis
 */

import type { Tier } from '@/seed/types'
import { aggregateUsageForLicense } from './usage-aggregator-query'
import type { UsageSummary, OverageDetected, UsageForecast } from './usage-aggregator-types'

export function detectOverageEvents(summary: UsageSummary): OverageDetected[] {
  const overages: OverageDetected[] = []
  if (summary.hourlyOverage > 0) {
    overages.push({ type: 'hourly_credits', limit: summary.hourlyLimit, current: summary.hourlyCredits, exceededBy: summary.hourlyOverage })
  }
  if (summary.dailyOverage > 0) {
    overages.push({ type: 'daily_credits', limit: summary.dailyLimit, current: summary.dailyCredits, exceededBy: summary.dailyOverage })
  }
  if (summary.monthlyOverage > 0) {
    overages.push({ type: 'monthly_credits', limit: summary.monthlyLimit, current: summary.monthlyCredits, exceededBy: summary.monthlyOverage })
  }
  if (summary.dailyRequestOverage > 0) {
    overages.push({ type: 'daily_requests', limit: summary.dailyRequestLimit, current: summary.dailyRequests, exceededBy: summary.dailyRequestOverage })
  }
  return overages
}

export function predictUsageForecast(summary: UsageSummary, daysIntoPeriod?: number): UsageForecast {
  const now = new Date()
  const periodEnd = new Date(summary.periodEnd * 1000)
  const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const daysElapsed = daysIntoPeriod || now.getDate()
  const dailyAverage = summary.monthlyCredits / Math.max(1, daysElapsed)
  const predictedUsage = dailyAverage * (daysElapsed + daysRemaining)
  const willExceedLimit = predictedUsage > summary.monthlyLimit
  const predictedOverage = willExceedLimit ? predictedUsage - summary.monthlyLimit : undefined

  let recommendation = 'Usage is within normal limits'
  if (willExceedLimit) {
    if (predictedOverage! > summary.monthlyLimit * 0.5) {
      recommendation = 'Critical: Consider upgrading plan immediately to avoid service interruption'
    } else if (predictedOverage! > summary.monthlyLimit * 0.2) {
      recommendation = 'Warning: You are projected to exceed your plan limits. Consider upgrading or reducing usage'
    } else {
      recommendation = 'Notice: You may slightly exceed your plan limits this period'
    }
  } else if (summary.monthlyPercentage > 80) {
    recommendation = 'Caution: You have used 80%+ of your monthly allocation'
  }

  return {
    predictedUsage: Math.round(predictedUsage), willExceedLimit,
    predictedOverage: predictedOverage ? Math.round(predictedOverage) : undefined,
    daysRemaining, dailyAverage: Math.round(dailyAverage), recommendation,
  }
}

export async function getUsageWithForecast(licenseNonce: string): Promise<{
  summary: UsageSummary
  overages: OverageDetected[]
  forecast: UsageForecast
} | null> {
  const summary = await aggregateUsageForLicense(licenseNonce)
  if (!summary) return null
  return { summary, overages: detectOverageEvents(summary), forecast: predictUsageForecast(summary) }
}

const OVERAGE_RATES: Record<string, number> = { BASIC: 0.10, PREMIUM: 0.05, ENTERPRISE: 0.03, MASTER: 0.02 }

export function calculateOverageEstimate(
  overages: OverageDetected[],
  tier: Tier,
): { totalEstimate: number; breakdown: { type: string; units: number; rate: number; amount: number }[] } {
  const rate = OVERAGE_RATES[tier] || OVERAGE_RATES.BASIC
  const breakdown: { type: string; units: number; rate: number; amount: number }[] = []
  let totalEstimate = 0
  for (const overage of overages) {
    const amount = Math.round(overage.exceededBy * rate * 100) / 100
    breakdown.push({ type: overage.type, units: overage.exceededBy, rate, amount })
    totalEstimate += amount
  }
  return { totalEstimate, breakdown }
}
