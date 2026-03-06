import { createAdminClient } from '@/lib/supabase/admin';
import { Tier } from '@/types';

// Define Tier Config hierarchy and limitations
export const TIER_CONFIG: Record<Tier, { rank: number; label: string; features: string[] }> = {
  BASIC: {
    rank: 1,
    label: 'Basic',
    features: ['1 YouTube Channel', '5 Templates', 'Basic Analytics']
  },
  PREMIUM: {
    rank: 2,
    label: 'Premium',
    features: ['3 YouTube Channels', 'Unlimited Templates', 'Advanced Analytics', 'Priority Support']
  },
  ENTERPRISE: {
    rank: 3,
    label: 'Enterprise',
    features: ['Unlimited Channels', 'Custom Templates', 'White-labeling', 'Dedicated Account Manager', 'API Access']
  },
  MASTER: {
    rank: 4,
    label: 'Master',
    features: ['Everything in Enterprise', 'Lifetime Access', 'VIP Support Forever', 'Monthly Strategy Calls', 'Early Access']
  }
};

// Map DB values to Types
export const DB_TIER_MAPPING: Record<string, Tier> = {
  'basic': 'BASIC',
  'premium': 'PREMIUM',
  'pro': 'PREMIUM', // Backward compatibility
  'enterprise': 'ENTERPRISE',
  'master': 'MASTER',
  'free': 'BASIC' // Default fallback if needed
};

export const TIER_DB_MAPPING: Record<Tier, string> = {
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
  MASTER: 'master'
};

/**
 * Get user's current active tier
 * Returns BASIC if:
 * - No subscription found
 * - Subscription expired (subscription_expires_at < now)
 */
export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = createAdminClient() as any;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !(data as any)?.subscription_tier) {
    return 'BASIC'; // Default to Basic
  }

  const tier = DB_TIER_MAPPING[(data as any).subscription_tier] || 'BASIC';

  // MASTER tier = lifetime one-time purchase — NEVER expires
  if (tier === 'MASTER') {
    return 'MASTER';
  }

  // Check if subscription has expired (for recurring tiers only)
  if ((data as any).subscription_expires_at) {
    const expiresAt = new Date((data as any).subscription_expires_at);
    const now = new Date();

    if (expiresAt < now) {
      // Subscription expired - downgrade to BASIC
      return 'BASIC';
    }
  }

  return tier;
}

/**
 * Check if user has access to a specific tier level
 */
export async function checkTierAccess(userId: string, requiredTier: Tier): Promise<boolean> {
  const currentTier = await getUserTier(userId);

  const currentRank = TIER_CONFIG[currentTier].rank;
  const requiredRank = TIER_CONFIG[requiredTier].rank;

  return currentRank >= requiredRank;
}

/**
 * Compare tiers without async (for client-side use)
 */
export function isTierHigherOrEqual(currentTier: Tier, requiredTier: Tier): boolean {
  return TIER_CONFIG[currentTier].rank >= TIER_CONFIG[requiredTier].rank;
}

/**
 * Get subscription status for display
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: Tier;
  isActive: boolean;
  expiresAt: Date | null;
  daysRemaining: number | null;
}> {
  const supabase = createAdminClient() as any;

  const { data } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_expires_at')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return { tier: 'BASIC', isActive: false, expiresAt: null, daysRemaining: null };
  }

  const tier = DB_TIER_MAPPING[(data as any).subscription_tier] || 'BASIC';
  const expiresAt = (data as any).subscription_expires_at ? new Date((data as any).subscription_expires_at) : null;
  const now = new Date();

  // MASTER tier is always active (lifetime purchase)
  const isActive = tier === 'MASTER' || !expiresAt || expiresAt > now;
  const daysRemaining = tier === 'MASTER' ? null : expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return { tier, isActive, expiresAt, daysRemaining };
}
