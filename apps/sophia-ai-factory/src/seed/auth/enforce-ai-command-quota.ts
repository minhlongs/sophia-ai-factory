/**
 * Server-side AI command monthly quota enforcement.
 *
 * Sibling to enforce-tier-quota.ts (video) — this one gates the per-tier
 * monthly mission count claimed on the pricing page
 * ("5 AI commands/month", "15 AI commands/month", "Unlimited").
 *
 * Counts engine_missions rows for current month and compares to
 * UNIFIED_TIERS[tier].aiCommands. Limit of 999 is treated as unlimited.
 *
 * @module seed/auth/enforce-ai-command-quota
 */

import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { createServerClient } from '@/seed/db/client';
import { getAiCommandLimit } from '@/seed/config/tiers';

export interface AiCommandQuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  /** ISO timestamp when the quota resets (start of next month UTC) */
  resetsAt: string;
  /** Human-readable reason when allowed=false */
  reason?: string;
}

const UNLIMITED_SENTINEL = 999;

function startOfMonthEpochSec(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
}

function nextMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Check whether `userId` may execute another AI command this month.
 * Pre-write gate — call before inserting a row into engine_missions.
 */
export async function checkAiCommandQuota(userId: string): Promise<AiCommandQuotaResult> {
  const tier = await resolveUserTier(userId);
  const limit = getAiCommandLimit(tier);
  const resetsAt = nextMonthIso();

  if (limit >= UNLIMITED_SENTINEL) {
    return { allowed: true, used: 0, limit, resetsAt };
  }

  const db = createServerClient();
  const monthStart = startOfMonthEpochSec();

  const { data } = (await db
    .from('engine_missions')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', monthStart)) as { data: Array<{ id: string }> | null };

  const used = data?.length ?? 0;

  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      resetsAt,
      reason: `Monthly AI command limit of ${limit} reached for tier ${tier}. Upgrade for more.`,
    };
  }

  return { allowed: true, used, limit, resetsAt };
}
