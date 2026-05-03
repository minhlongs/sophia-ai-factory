/**
 * Get user's subscription tier from D1.
 * Reads 'plan' column from subscriptions table (stored lowercase per
 * migration 0001) and normalizes via DB_TIER_MAPPING to the uppercase
 * Tier enum. Returns 'BASIC' on any miss.
 */

import { Tier } from '@/seed/types';
import { DB_TIER_MAPPING } from '@/seed/config/tiers';

function getD1(): D1Database | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.DB) return env.DB as D1Database;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
  if (ctx?.env?.DB) return ctx.env.DB as D1Database;
  return null;
}

/**
 * Phase 4F.3: normalize DB plan string ('premium', 'pro', 'free', ...)
 * to the canonical `Tier` enum value. Unknown or null → 'BASIC'.
 */
export function normalizePlanToTier(plan: string | null | undefined): Tier {
  if (!plan) return 'BASIC' as Tier;
  return DB_TIER_MAPPING[plan.toLowerCase()] ?? ('BASIC' as Tier);
}

export async function getUserTier(userId: string): Promise<Tier> {
  try {
    const d1 = getD1();
    if (!d1) return 'BASIC' as Tier;

    const member = await d1.prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(userId).first<{ org_id: string }>();
    if (!member) return 'BASIC' as Tier;

    const sub = await d1.prepare("SELECT plan FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1")
      .bind(member.org_id).first<{ plan: string }>();

    return normalizePlanToTier(sub?.plan);
  } catch {
    return 'BASIC' as Tier;
  }
}
