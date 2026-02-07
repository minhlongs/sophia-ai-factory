import { getActiveSubscription } from '@/lib/payments/polar-subscription-service'
import { Tier } from '@/types'
import { TIER_CONFIG } from '@/lib/subscription'

/**
 * Subscription gate middleware for API routes and bot commands
 * Checks if user has an active subscription at the required tier
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
  const subscription = await getActiveSubscription(userId)

  if (!subscription || subscription.status !== 'active') {
    return {
      authorized: false,
      currentTier: 'BASIC',
      requiredTier,
      message: `This feature requires a ${requiredTier === 'ENTERPRISE' ? 'Premium' : 'Growth'} subscription.`,
    }
  }

  const currentRank = TIER_CONFIG[subscription.tier].rank
  const requiredRank = TIER_CONFIG[requiredTier].rank

  if (currentRank < requiredRank) {
    return {
      authorized: false,
      currentTier: subscription.tier,
      requiredTier,
      message: `Your current plan doesn't include this feature. Upgrade to access it.`,
    }
  }

  return {
    authorized: true,
    currentTier: subscription.tier,
    requiredTier,
  }
}
