/**
 * Pure utility functions for NOWPayments IPN subscription lifecycle.
 *
 * Extracted from nowpayments-ipn-subscription.ts to keep modules under 200 lines
 * and enable isolated testing of billing period calculations.
 *
 * @module billing/nowpayments-ipn-utils
 */

import type { Tier } from '@/seed/types'

// ── Period Calculation ──────────────────────────────────────────────────────

export function calculatePeriodEnd(billingPeriod: 'monthly' | 'yearly' | 'lifetime'): string {
  if (billingPeriod === 'lifetime') {
    return new Date('2099-12-31T23:59:59Z').toISOString()
  }
  const days = billingPeriod === 'yearly' ? 365 : 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function stackedPeriodEnd(
  existingPeriodEnd: string | null | undefined,
  billingPeriod: 'monthly' | 'yearly' | 'lifetime',
  now: string,
  defaultPeriodEnd: string
): string {
  if (billingPeriod === 'lifetime') return defaultPeriodEnd
  if (!existingPeriodEnd) return defaultPeriodEnd
  const existingMs = Date.parse(existingPeriodEnd)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(existingMs) || existingMs <= nowMs) return defaultPeriodEnd
  const days = billingPeriod === 'yearly' ? 365 : 30
  return new Date(existingMs + days * 24 * 60 * 60 * 1000).toISOString()
}

// ── Tier Comparison ─────────────────────────────────────────────────────────

export function wouldDowngradeTier(currentPlan: string, newTier: Tier): boolean {
  const TIER_RANK: Record<string, number> = { basic: 0, premium: 1, enterprise: 2, master: 3 }
  const currentRank = TIER_RANK[currentPlan.toLowerCase()] ?? -1
  const newRank = TIER_RANK[newTier.toLowerCase()] ?? -1
  return currentRank > newRank
}
