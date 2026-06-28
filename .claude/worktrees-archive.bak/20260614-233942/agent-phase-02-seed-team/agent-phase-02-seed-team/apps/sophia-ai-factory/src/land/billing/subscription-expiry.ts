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
