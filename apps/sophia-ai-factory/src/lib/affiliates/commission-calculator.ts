/**
 * Commission Calculator
 *
 * Pure function to split ClickBank net commission 70/30 between user and Sophia.
 * Handles negative amounts (refunds/chargebacks) proportionally.
 * Phase 13: adds tier-aware multiplier for payout commission calculation.
 *
 * @module affiliates/commission-calculator
 */

import { USER_SHARE_PCT, SOPHIA_SHARE_PCT } from '@/seed/config/revenue-share'

export interface CommissionSplit {
  /** User's share (70% of gross) — negative for refunds */
  user: number
  /** Sophia platform's share (30% of gross) — negative for refunds */
  sophia: number
}

/**
 * Calculate the 70/30 commission split from a gross affiliate amount.
 *
 * @param grossAmount - Net commission reported by ClickBank (may be negative for refunds)
 * @returns Split amounts rounded to 4 decimal places
 */
export function calcCommission(grossAmount: number): CommissionSplit {
  const user = Math.round(grossAmount * USER_SHARE_PCT * 10000) / 10000
  const sophia = Math.round(grossAmount * SOPHIA_SHARE_PCT * 10000) / 10000
  return { user, sophia }
}

// Tier multipliers: free/pro/enterprise → 0.7x / 1.0x / 1.3x
// Maps Sophia tier names to multipliers
const TIER_MULTIPLIERS: Record<string, number> = {
  BASIC: 0.7,
  PREMIUM: 1.0,
  ENTERPRISE: 1.3,
  MASTER: 1.3,
  // Aliases
  free: 0.7,
  pro: 1.0,
  enterprise: 1.3,
}

export interface CommissionInput {
  grossAmountUsd: number
  /** Offer's base commission percentage (e.g. 0.3 = 30%) */
  offerCommissionPct: number
  /** Tenant/user tier — determines multiplier */
  tenantTier: string
}

export interface CommissionOutput {
  commissionUsd: number
  commissionPct: number
}

/**
 * Calculate tier-aware commission for payout ledger.
 * commission_usd = gross × base_pct × tier_multiplier
 *
 * @param input - gross amount, offer base commission pct, tenant tier
 * @returns commissionUsd and effective commissionPct rounded to 4dp
 */
export function calculateCommission(input: CommissionInput): CommissionOutput {
  const multiplier = TIER_MULTIPLIERS[input.tenantTier] ?? 1.0
  const effectivePct = Math.min(input.offerCommissionPct * multiplier, 1.0)
  const commissionUsd = Math.round(input.grossAmountUsd * effectivePct * 10000) / 10000
  return { commissionUsd, commissionPct: effectivePct }
}
