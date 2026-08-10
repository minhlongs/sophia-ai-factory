/**
 * Get user's configured routing strategy from user_profiles.settings JSON.
 *
 * Reads the 'routing_strategy' key from the user_profiles.settings JSON blob.
 * Validates against StrategyNameSchema. Returns null for missing, malformed,
 * or invalid values (caller falls back to tier default, then priority).
 *
 * Uses the canonical D1 client (createServerClient) — async because first() is async.
 */

import { createServerClient } from '@/seed/db/client';
import { StrategyNameSchema, type StrategyName, TIER_DEFAULT_STRATEGY } from '@/seed/config/routing-strategies';

/**
 * Read user's configured routing strategy from user_profiles.
 * @param userId - The user ID to look up
 * @returns The validated StrategyName, or null if not set/invalid
 */
export async function getUserRoutingStrategy(userId: string): Promise<StrategyName | null> {
  const db = createServerClient();
  if (!db) return null;

  try {
    const row = await db
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?1')
      .bind(userId)
      .first<{ settings: string | null }>();

    if (!row?.settings) return null;

    const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
    if (!settings || typeof settings !== 'object') return null;

    const strategyValue = settings.routing_strategy;
    if (typeof strategyValue !== 'string') return null;

    const parsed = StrategyNameSchema.safeParse(strategyValue);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Get the default routing strategy for a given tier.
 * @param tier - The user's subscription tier
 * @returns The tier's default StrategyName
 */
export function getDefaultStrategyForTier(tier: string): StrategyName {
  return TIER_DEFAULT_STRATEGY[tier as keyof typeof TIER_DEFAULT_STRATEGY] ?? 'priority';
}