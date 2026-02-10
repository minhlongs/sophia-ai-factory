import { createAdminClient } from '@/lib/supabase/admin'
import { getRedisClient } from '@/lib/clients/upstash-redis-client'
import { Tier } from '@/types'
import { DB_TIER_MAPPING, TIER_DB_MAPPING } from '@/lib/subscription'
import { SubscriptionRecord } from './polar-types'

const CACHE_PREFIX = 'sub:'
const CACHE_TTL = 3600 // 1 hour

/**
 * Subscription CRUD service with Redis caching
 */

function getSupabase() {
  return createAdminClient()
}

/**
 * Get active subscription for a user (cached)
 */
export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionRecord | null> {
  const redis = getRedisClient()
  const cacheKey = `${CACHE_PREFIX}${userId}`

  // Check cache
  const cached = await redis.get<SubscriptionRecord>(cacheKey)
  if (cached) return cached

  // Query DB
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'user_id, subscription_tier, subscription_status, polar_subscription_id, subscription_expires_at'
    )
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  const tier = DB_TIER_MAPPING[data.subscription_tier] || 'BASIC'
  if (tier === 'BASIC') return null

  const record: SubscriptionRecord = {
    userId: data.user_id,
    tier: tier as Tier,
    polarSubscriptionId: data.polar_subscription_id || '',
    status: data.subscription_status === 'active' ? 'active' : 'cancelled',
    currentPeriodEnd: data.subscription_expires_at || null,
    cancelAtPeriodEnd: false,
  }

  // Check expiry with 7-day grace period
  if (record.currentPeriodEnd) {
    const expiresAt = new Date(record.currentPeriodEnd)
    const gracePeriod = new Date(
      expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000
    )
    if (new Date() > gracePeriod) {
      record.status = 'expired'
    }
  }

  // Cache result
  await redis.set(cacheKey, JSON.stringify(record), { ex: CACHE_TTL })

  return record
}

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(
  userId: string,
  polarSubId: string,
  tier: Tier,
  periodEnd: string | null
): Promise<void> {
  const supabase = getSupabase()
  const dbTier = TIER_DB_MAPPING[tier]

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: dbTier,
      subscription_status: 'active',
      polar_subscription_id: polarSubId,
      subscription_expires_at: periodEnd,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  await invalidateCache(userId)
}

/**
 * Cancel subscription (keeps access until period end + grace period)
 */
export async function cancelSubscription(
  polarSubId: string
): Promise<string | null> {
  const supabase = getSupabase()

  // Find user by polar subscription ID
  const { data: user } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('polar_subscription_id', polarSubId)
    .single()

  if (!user) return null

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', user.user_id)

  if (error) {
    throw error
  }

  await invalidateCache(user.user_id)
  return user.user_id
}

/**
 * Expire subscription (revoke access)
 */
export async function expireSubscription(userId: string): Promise<void> {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: 'basic',
      subscription_status: 'expired',
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  await invalidateCache(userId)
}

/**
 * Invalidate subscription cache for a user
 */
export async function invalidateCache(userId: string): Promise<void> {
  const redis = getRedisClient()
  await redis.del(`${CACHE_PREFIX}${userId}`)
}

/**
 * Find user ID by Polar subscription ID
 */
export async function findUserByPolarSubId(
  polarSubId: string
): Promise<string | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('polar_subscription_id', polarSubId)
    .single()

  return data?.user_id || null
}
