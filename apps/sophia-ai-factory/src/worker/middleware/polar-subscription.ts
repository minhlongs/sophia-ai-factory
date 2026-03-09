/**
 * Polar Subscription Status Service for Cloudflare Worker
 * Fetches and caches subscription status from Polar/KV for access control
 *
 * @module worker/middleware/polar-subscription
 */

// Cloudflare Worker types
/// <reference types="@cloudflare/workers-types" />

/**
 * Polar subscription data structure
 */
export interface PolarSubscription {
  customer_id: string;
  subscription_id: string;
  status: 'active' | 'inactive' | 'past_due' | 'canceled';
  tier: 'starter' | 'growth' | 'premium' | 'master';
  features: string[];
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  ended_at?: number;
}

/**
 * Subscription status cached in KV
 */
interface CachedSubscriptionStatus {
  status: PolarSubscription['status'];
  tier: PolarSubscription['tier'];
  features: string[];
  cachedAt: number;
  expiresAt: number;
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  subscriptionTtlSeconds: 600, // 10 minutes for subscription status
  keyPrefix: 'polar:subscription:',
};

/**
 * Tier mapping from Polar to internal tiers
 */
const TIER_MAP: Record<string, 'starter' | 'growth' | 'premium' | 'master'> = {
  'starter': 'starter',
  'growth': 'growth',
  'premium': 'premium',
  'master': 'master',
  // Legacy tier mappings
  'free': 'starter',
  'basic': 'starter',
  'pro': 'growth',
  'enterprise': 'premium',
};

/**
 * Map Polar tier to RaaS license tier
 */
export function mapPolarTierToRaaSTier(polarTier: string): 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' {
  const tierMap: Record<string, 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'> = {
    'starter': 'BASIC',
    'growth': 'PREMIUM',
    'premium': 'ENTERPRISE',
    'master': 'MASTER',
  };

  return tierMap[polarTier] || 'BASIC';
}

/**
 * Generate KV cache key for subscription
 */
function getSubscriptionKey(customerId: string): string {
  return `${CACHE_CONFIG.keyPrefix}${customerId}`;
}

/**
 * Get subscription status from KV cache
 *
 * @param polarCustomerId - Polar customer identifier
 * @param kv - Cloudflare KV namespace
 * @returns Subscription status or null if not found/expired
 */
export async function getSubscriptionStatus(
  polarCustomerId: string,
  kv: KVNamespace
): Promise<PolarSubscription | null> {
  try {
    const key = getSubscriptionKey(polarCustomerId);
    const cached = await kv.get<CachedSubscriptionStatus>(key);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    const now = Date.now();
    if (now > cached.expiresAt) {
      // Cache expired, delete it
      await kv.delete(key);
      return null;
    }

    return {
      customer_id: polarCustomerId,
      subscription_id: '', // Not stored in cache
      status: cached.status,
      tier: cached.tier,
      features: cached.features,
    };
  } catch (error) {
    console.error('[Polar Subscription] Cache read error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Cache subscription status in KV
 *
 * @param polarCustomerId - Polar customer identifier
 * @param subscription - Subscription data to cache
 * @param kv - Cloudflare KV namespace
 * @returns true if cached successfully
 */
export async function cacheSubscriptionStatus(
  polarCustomerId: string,
  subscription: PolarSubscription,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const key = getSubscriptionKey(polarCustomerId);
    const now = Date.now();

    const cacheData: CachedSubscriptionStatus = {
      status: subscription.status,
      tier: subscription.tier,
      features: subscription.features,
      cachedAt: now,
      expiresAt: now + (CACHE_CONFIG.subscriptionTtlSeconds * 1000),
    };

    await kv.put(key, JSON.stringify(cacheData), {
      expirationTtl: CACHE_CONFIG.subscriptionTtlSeconds,
    });

    return true;
  } catch (error) {
    console.error('[Polar Subscription] Cache write error:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Invalidate subscription cache (e.g., after webhook event)
 *
 * @param polarCustomerId - Polar customer identifier
 * @param kv - Cloudflare KV namespace
 * @returns true if deleted successfully
 */
export async function invalidateSubscriptionCache(
  polarCustomerId: string,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const key = getSubscriptionKey(polarCustomerId);
    await kv.delete(key);
    return true;
  } catch (error) {
    console.error('[Polar Subscription] Cache invalidation error:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Check if tier is eligible for overage billing
 * Only premium and master tiers can be charged overage fees
 *
 * @param tier - Subscription tier
 * @returns true if overage billing is allowed
 */
export function isTierEligibleForOverage(tier: string): boolean {
  const normalizedTier = tier.toLowerCase();
  return (
    normalizedTier === 'premium' ||
    normalizedTier === 'master' ||
    normalizedTier === 'enterprise'
  );
}

/**
 * Check if subscription status allows API access
 *
 * @param status - Subscription status
 * @returns true if access is allowed
 */
export function isSubscriptionActive(status: string): boolean {
  return status === 'active' || status === 'past_due';
}

/**
 * Get subscription status with fallback to Polar API
 *
 * @param polarCustomerId - Polar customer identifier
 * @param kv - Cloudflare KV namespace
 * @param env - Worker environment with Polar API credentials
 * @returns Subscription status or null
 */
export async function getSubscriptionStatusWithFallback(
  polarCustomerId: string,
  kv: KVNamespace,
  env: { POLAR_API_KEY?: string; POLAR_API_URL?: string }
): Promise<PolarSubscription | null> {
  // Try cache first
  const cached = await getSubscriptionStatus(polarCustomerId, kv);
  if (cached) {
    return cached;
  }

  // Fetch from Polar API
  try {
    if (!env.POLAR_API_KEY || !env.POLAR_API_URL) {
      console.warn('[Polar Subscription] Polar API credentials not configured');
      return null;
    }

    const response = await fetch(
      `${env.POLAR_API_URL}/subscriptions?customer_id=${polarCustomerId}`,
      {
        headers: {
          'Authorization': `Bearer ${env.POLAR_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn('[Polar Subscription] Failed to fetch from Polar API', response.status);
      return null;
    }

    const data = await response.json();
    const subscription: PolarSubscription = {
      customer_id: polarCustomerId,
      subscription_id: data.id || '',
      status: data.status || 'inactive',
      tier: TIER_MAP[data.tier || 'starter'] || 'starter',
      features: data.features || [],
      current_period_start: data.current_period_start,
      current_period_end: data.current_period_end,
      cancel_at_period_end: data.cancel_at_period_end,
      ended_at: data.ended_at,
    };

    // Cache the result
    await cacheSubscriptionStatus(polarCustomerId, subscription, kv);

    return subscription;
  } catch (error) {
    console.error('[Polar Subscription] Fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Build subscription-based access decision
 *
 * @param subscription - Subscription data
 * @returns Access decision with reason
 */
export function checkSubscriptionAccess(
  subscription: PolarSubscription | null
): {
  allowed: boolean;
  reason?: 'no_subscription' | 'inactive' | 'canceled' | 'past_due';
  tier?: string;
} {
  if (!subscription) {
    return { allowed: false, reason: 'no_subscription' };
  }

  if (subscription.status === 'canceled' || subscription.status === 'inactive') {
    return { allowed: false, reason: subscription.status };
  }

  if (subscription.status === 'past_due') {
    // Allow access but mark as past_due for dunning workflow
    return {
      allowed: true,
      tier: subscription.tier,
      reason: 'past_due',
    };
  }

  if (subscription.status === 'active') {
    return {
      allowed: true,
      tier: subscription.tier,
    };
  }

  return { allowed: false, reason: 'inactive' };
}

/**
 * Get feature entitlements from Polar subscription
 *
 * @param subscription - Polar subscription
 * @returns Array of feature keys
 */
export function getFeaturesFromSubscription(
  subscription: PolarSubscription
): string[] {
  if (!subscription.features || subscription.features.length === 0) {
    // Fallback to tier defaults
    const tierFeatures: Record<string, string[]> = {
      starter: [
        'heygen.createVideo',
        'heygen.getVideoStatus',
        'elevenlabs.synthesize',
        'elevenlabs.getAudioStatus',
        'openrouter.chat',
        'openrouter.complete',
      ],
      growth: [
        'heygen.createVideo',
        'heygen.getVideoStatus',
        'heygen.listTemplates',
        'elevenlabs.synthesize',
        'elevenlabs.getAudioStatus',
        'elevenlabs.listVoices',
        'openrouter.chat',
        'openrouter.complete',
        'openrouter.listModels',
        'affiliate.engine',
        'roi.calculator',
        'analytics.basic',
      ],
      premium: [
        'heygen.createVideo',
        'heygen.getVideoStatus',
        'heygen.listTemplates',
        'heygen.listAvatars',
        'elevenlabs.synthesize',
        'elevenlabs.getAudioStatus',
        'elevenlabs.listVoices',
        'elevenlabs.listModels',
        'openrouter.chat',
        'openrouter.complete',
        'openrouter.listModels',
        'openrouter.tokenize',
        'affiliate.engine',
        'roi.calculator',
        'analytics.basic',
        'analytics.advanced',
        'api.integrations',
        'auto.update',
        'admin.dashboard',
      ],
      master: [
        'heygen.createVideo',
        'heygen.getVideoStatus',
        'heygen.listTemplates',
        'heygen.listAvatars',
        'elevenlabs.synthesize',
        'elevenlabs.getAudioStatus',
        'elevenlabs.listVoices',
        'elevenlabs.listModels',
        'openrouter.chat',
        'openrouter.complete',
        'openrouter.listModels',
        'openrouter.tokenize',
        'affiliate.engine',
        'roi.calculator',
        'analytics.basic',
        'analytics.advanced',
        'api.integrations',
        'auto.update',
        'admin.dashboard',
        'white.label',
        'custom.branding',
        'priority.support',
      ],
    };

    return tierFeatures[subscription.tier] || tierFeatures.starter;
  }

  return subscription.features;
}

/**
 * Calculate days until subscription renewal
 *
 * @param subscription - Polar subscription
 * @returns Days until renewal or null if unknown
 */
export function getDaysUntilRenewal(
  subscription: PolarSubscription
): number | null {
  if (!subscription.current_period_end) {
    return null;
  }

  const now = Date.now();
  const endDate = subscription.current_period_end * 1000; // Convert to ms
  const diff = endDate - now;

  if (diff <= 0) {
    return 0; // Already expired
  }

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if subscription is expiring soon (within N days)
 *
 * @param subscription - Polar subscription
 * @param thresholdDays - Days threshold (default: 7)
 * @returns true if expiring soon
 */
export function isSubscriptionExpiringSoon(
  subscription: PolarSubscription,
  thresholdDays: number = 7
): boolean {
  const daysUntilRenewal = getDaysUntilRenewal(subscription);

  if (daysUntilRenewal === null) {
    return false;
  }

  return daysUntilRenewal <= thresholdDays;
}
