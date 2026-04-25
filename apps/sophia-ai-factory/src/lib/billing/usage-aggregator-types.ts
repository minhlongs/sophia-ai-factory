/**
 * Types and period utilities for Usage Aggregator
 * @module billing/usage-aggregator-types
 */

import type { Tier } from '@/types'

export interface UsageSummary {
  userId: string
  licenseNonce: string
  tier: Tier
  periodStart: number
  periodEnd: number
  hourlyCredits: number
  hourlyLimit: number
  hourlyOverage: number
  dailyCredits: number
  dailyLimit: number
  dailyOverage: number
  monthlyCredits: number
  monthlyLimit: number
  monthlyOverage: number
  dailyRequests: number
  dailyRequestLimit: number
  dailyRequestOverage: number
  hourlyPercentage: number
  dailyPercentage: number
  monthlyPercentage: number
  status: 'ok' | 'warning' | 'critical' | 'overage'
  polarCustomerId?: string
  lastPolarSync?: string
}

export interface OverageDetected {
  type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  limit: number
  current: number
  exceededBy: number
  overageFee?: number
}

export interface UsageForecast {
  predictedUsage: number
  willExceedLimit: boolean
  predictedOverage?: number
  daysRemaining: number
  dailyAverage: number
  recommendation: string
}

export function getCurrentBillingPeriod(): { periodStart: number; periodEnd: number } {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
  return { periodStart, periodEnd }
}
