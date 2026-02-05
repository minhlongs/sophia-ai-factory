import { createClient } from '@supabase/supabase-js';
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
  }
};

// Map DB values to Types
export const DB_TIER_MAPPING: Record<string, Tier> = {
  'basic': 'BASIC',
  'premium': 'PREMIUM',
  'pro': 'PREMIUM', // Backward compatibility
  'enterprise': 'ENTERPRISE',
  'free': 'BASIC' // Default fallback if needed
};

export const TIER_DB_MAPPING: Record<Tier, string> = {
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'
};

export async function getUserTier(userId: string): Promise<Tier> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier')
    .eq('user_id', userId)
    .single();

  if (error || !data?.subscription_tier) {
    return 'BASIC'; // Default to Basic (or Free if we had it, but Basic is lowest tier in types)
  }

  return DB_TIER_MAPPING[data.subscription_tier] || 'BASIC';
}

export async function checkTierAccess(userId: string, requiredTier: Tier): Promise<boolean> {
  const currentTier = await getUserTier(userId);
  
  const currentRank = TIER_CONFIG[currentTier].rank;
  const requiredRank = TIER_CONFIG[requiredTier].rank;

  return currentRank >= requiredRank;
}

export function isTierHigherOrEqual(currentTier: Tier, requiredTier: Tier): boolean {
  return TIER_CONFIG[currentTier].rank >= TIER_CONFIG[requiredTier].rank;
}
