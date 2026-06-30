/**
 * Quota response factories — 429/account_suspended response builders
 * @module quota/quota-enforcer-response
 */

import type { EnhancedQuotaCheckResult, QuotaCheckContext } from './quota-checker'
import type { DunningState } from '@/seed/types/billing-contracts'
import { TOPUP_PRICE_PER_MCU } from '@/land/billing/overage-topup-types'

export interface QuotaExceededResponse {
  error: string
  code: 'quota_exceeded' | 'account_suspended'
  message: string
  exceeded: { type: string; limit: number; current: number; requested: number }
  remaining: { dailyCredits: number; hourlyCredits: number; monthlyCredits: number; dailyRequests: number }
  retryAfter: number
  upgradeUrl: string
  topUpUrl?: string
  pricePerCredit?: number
  dunningState?: DunningState
  dunningReason?: string
}

function getRetryAfterSeconds(exceededType: string): number {
  const now = Math.floor(Date.now() / 1000)
  switch (exceededType) {
    case 'hourly_credits': return 3600 - (now % 3600)
    case 'daily_credits':
    case 'daily_requests': return 86400 - (now % 86400)
    case 'monthly_credits': return 30 * 86400
    default: return 3600
  }
}

export function createQuotaExceededResponse(
  result: EnhancedQuotaCheckResult,
  context: QuotaCheckContext
): QuotaExceededResponse {
  const exceededType = result.exceeded?.type || 'unknown'
  const retryAfterSeconds = getRetryAfterSeconds(exceededType)
  const errorMessages: Record<string, string> = {
    hourly_credits: 'Hourly credit limit exceeded',
    daily_credits: 'Daily credit limit exceeded',
    monthly_credits: 'Monthly credit limit exceeded',
    daily_requests: 'Daily request limit exceeded',
  }
  return {
    error: 'quota_exceeded',
    code: 'quota_exceeded',
    message: errorMessages[exceededType] || 'Usage limit exceeded',
    exceeded: { type: exceededType, limit: result.exceeded?.limit || 0, current: result.exceeded?.current || 0, requested: context.requestedCredits },
    remaining: result.remaining,
    retryAfter: retryAfterSeconds,
    upgradeUrl: '/dashboard/billing',
    topUpUrl: '/dashboard/billing?tab=topup',
    pricePerCredit: TOPUP_PRICE_PER_MCU,
  }
}

export function createDunningBlockResponse(
  dunningCheck: { state: DunningState; reason?: string }
): QuotaExceededResponse {
  return {
    error: 'account_suspended',
    code: 'account_suspended',
    message: dunningCheck.reason || 'Your account has been suspended due to non-payment',
    exceeded: { type: 'dunning_state', limit: 0, current: 0, requested: 0 },
    remaining: { dailyCredits: 0, hourlyCredits: 0, monthlyCredits: 0, dailyRequests: 0 },
    retryAfter: 0,
    upgradeUrl: '/dashboard/billing',
    dunningState: dunningCheck.state,
    dunningReason: dunningCheck.reason,
  }
}
