import { createServerClient } from '@/seed/db/client'
import { Tier } from '@/seed/types'
import { TIER_CONFIG } from '@/seed/config/tiers'

/**
 * Subscription gate middleware for API routes and bot commands
 * Checks if user has an active subscription at the required tier
 * Tier is set in DB by NOWPayments IPN webhook
 */

interface GateResult {
  authorized: boolean
  currentTier: Tier
  requiredTier: Tier
  message?: string
}

/**
 * Check if a user has access to a premium feature
 */
export async function checkSubscriptionGate(
  userId: string,
  requiredTier: Tier = 'PREMIUM'
): Promise<GateResult> {
  const db = createServerClient()

  // Get tier from raas_licenses table (set by NOWPayments IPN webhook)
  const { data: rawLicense } = await db
    .from('raas_licenses')
    .select('tier, status')
    .eq('created_by', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  const license = rawLicense as { tier: string | null; status: string | null } | null

  if (!license) {
    return {
      authorized: false,
      currentTier: 'BASIC',
      requiredTier,
      message: `This feature requires a ${requiredTier === 'ENTERPRISE' ? 'Premium' : 'Growth'} subscription.`,
    }
  }

  const currentTier = (license.tier || 'BASIC').toUpperCase() as Tier
  const currentRank = TIER_CONFIG[currentTier]?.rank ?? 0
  const requiredRank = TIER_CONFIG[requiredTier]?.rank ?? 0

  if (currentRank < requiredRank) {
    return {
      authorized: false,
      currentTier,
      requiredTier,
      message: `Your current plan doesn't include this feature. Upgrade to access it.`,
    }
  }

  return {
    authorized: true,
    currentTier,
    requiredTier,
  }
}
