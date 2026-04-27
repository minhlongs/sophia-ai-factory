/**
 * Commission Calculator
 *
 * Pure function to split ClickBank net commission 70/30 between user and Sophia.
 * Handles negative amounts (refunds/chargebacks) proportionally.
 *
 * @module affiliates/commission-calculator
 */

import { USER_SHARE_PCT, SOPHIA_SHARE_PCT } from '@/config/revenue-share'

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
