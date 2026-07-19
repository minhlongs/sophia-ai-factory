/**
 * Helper to fetch subscription period_end for a user.
 * Used by settings page to show renewal date in plan-upgrade-widget.
 * @module billing/subscription-expiry
 */

import { createServerClient } from '@/seed/db/client'

/**
 * Get subscription period_end for a user's org.
 * Returns ISO string or null if not found.
 */
export async function getSubscriptionPeriodEnd(userId: string): Promise<string | null> {
  const db = createServerClient()
  const { data: m } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()
  if (!m?.org_id) return null

  const { data: s } = await db
    .from('subscriptions')
    .select('current_period_end,plan')
    .eq('org_id', m.org_id)
    .single()
  return (s as { current_period_end?: string } | null)?.current_period_end ?? null
}

// Additional utility functions for subscription expiry calculations
import { addDays, differenceInDays, isAfter } from 'date-fns'

/**
 * Calculate expiry date from base date based on billing cycle
 */
export function calculateExpiryDate(baseDate: Date, billingCycle: 'monthly' | 'yearly' | 'quarterly'): Date {
  switch (billingCycle) {
    case 'monthly':
      return addDays(baseDate, 30)
    case 'quarterly':
      return addDays(baseDate, 90)
    case 'yearly':
      return addDays(baseDate, 365)
    default:
      throw new Error(`Unknown billing cycle: ${billingCycle}`)
  }
}

/**
 * Check if subscription is expired
 */
export function isSubscriptionExpired(expiryDate: Date | string | null | undefined): boolean {
  if (!expiryDate) return true
  const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate)
  return isAfter(new Date(), expiry)
}

/**
 * Calculate days until expiry
 */
export function daysUntilExpiry(expiryDate: Date | string | null | undefined): number {
  if (!expiryDate) return 0
  const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate)
  return differenceInDays(expiry, new Date())
}
