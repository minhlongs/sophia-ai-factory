/**
 * Change Tier Server Action
 *
 * Allows an authenticated user to change their subscription tier.
 * - Upgrade: calculates prorated cost for remaining period
 * - Downgrade: calculates prorated credit, stored as account credit
 * - Blocked during dunning (payment issues)
 * - Same-tier change returns error
 * - MASTER requires separate payment flow
 *
 * @module land/billing/actions/change-tier-action
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import type { Tier } from '@/seed/types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ChangeTierResult {
  newTier: Tier;
  proratedAmount: number;
  effectiveDate: string;
}

export type BillingErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_ACTIVE_SUBSCRIPTION'
  | 'SUBSCRIPTION_NOT_ACTIVE'
  | 'ALREADY_ON_TIER'
  | 'IN_DUNNING'
  | 'MASTER_REQUIRES_SEPARATE_FLOW'
  | 'UPGRADE_REQUIRES_PAYMENT'
  | 'DB_ERROR'
  | 'INVALID_TIER'
  | 'GRACE_PERIOD_EXPIRED';

export interface BillingError {
  code: BillingErrorCode;
  message: string;
}

// ── Tier ranking ──────────────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

// ── Validation ────────────────────────────────────────────────────────────

const TierEnum = z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);

// ── Subscription row shape ────────────────────────────────────────────────

interface SubscriptionRow {
  id: string;
  org_id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: number;
  cancellation_date?: string | null;
}

// ── Pro-rata credit calculation ───────────────────────────────────────────

function calculateProRataCredit(
  currentTierPrice: number,
  periodStart: string,
  periodEnd: string,
): number {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const now = Date.now();

  if (now >= end || now <= start) return 0;

  const totalMs = end - start;
  const usedMs = now - start;
  const remainingRatio = 1 - usedMs / totalMs;

  return Math.max(0, Math.round(currentTierPrice * remainingRatio));
}

// ── Tier price lookup (from unified limits structure) ────────────────────

async function getTierPriceInCents(tier: Tier): Promise<number> {
  try {
    const { UNIFIED_TIERS } = await import('@/seed/config/tiers');
    return UNIFIED_TIERS[tier]?.priceInCents ?? 0;
  } catch {
    return 0;
  }
}

// ── Dunning state check ───────────────────────────────────────────────────

async function isUserInDunning(userId: string): Promise<boolean> {
  try {
    const d1 = await getD1();
    if (!d1) return false;

    const row = await d1
      .prepare('SELECT dunning_state FROM dunning_settings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .bind(userId)
      .first<{ dunning_state: string }>();

    if (!row) return false;
    return row.dunning_state !== 'current';
  } catch {
    return false;
  }
}

// ── Main action ───────────────────────────────────────────────────────────

export async function changeTier(
  targetTierRaw: string,
): Promise<Result<ChangeTierResult, BillingError>> {
  try {
    // Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // Validate target tier
    const parsed = TierEnum.safeParse(targetTierRaw);
    if (!parsed.success) {
      return failure({ code: 'INVALID_TIER', message: `Invalid tier: ${targetTierRaw}` });
    }
    const targetTier: Tier = parsed.data;

    // MASTER requires separate payment flow
    if (targetTier === 'MASTER') {
      return failure({
        code: 'MASTER_REQUIRES_SEPARATE_FLOW',
        message: 'Master tier requires separate payment flow. Please contact support.',
      });
    }

    // Get D1
    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // Get org for user
    const member = await d1
      .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
      .bind(user.id)
      .first<{ org_id: string }>();

    if (!member) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No organization found' });
    }

    const orgId = member.org_id;

    // Get current subscription
    const sub = await d1
      .prepare(
        "SELECT id, org_id, plan, status, current_period_start, current_period_end FROM subscriptions WHERE org_id = ? AND status = 'active' LIMIT 1",
      )
      .bind(orgId)
      .first<SubscriptionRow>();

    if (!sub) {
      return failure({ code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription found' });
    }

    const currentTier = normalizePlanToTier(sub.plan);

    // Same-tier check
    if (currentTier === targetTier) {
      return failure({
        code: 'ALREADY_ON_TIER',
        message: `You are already on the ${targetTier} tier`,
      });
    }

    // Dunning check
    const inDunning = await isUserInDunning(user.id);
    if (inDunning) {
      return failure({
        code: 'IN_DUNNING',
        message: 'Cannot change tier while account is in dunning state. Please resolve outstanding payments first.',
      });
    }

    // Determine if upgrade or downgrade
    const isDowngrade = (TIER_RANK[targetTier] ?? 0) < (TIER_RANK[currentTier] ?? 0);

    // Upgrades must go through the payment checkout flow — never a free D1 write.
    // Downgrades (reducing tier or cancelling) are allowed to proceed immediately.
    if (!isDowngrade) {
      return failure({
        code: 'UPGRADE_REQUIRES_PAYMENT',
        message: 'Upgrades require payment. Please complete checkout to activate the new tier.',
      });
    }

    // Downgrade: calculate prorated credit for unused days on current tier.
    // Downgrades take effect at end of billing cycle.
    const currentPrice = await getTierPriceInCents(currentTier);
    const proratedAmount = calculateProRataCredit(
      currentPrice,
      sub.current_period_start,
      sub.current_period_end,
    );
    const effectiveDate = sub.current_period_end;

    const now = new Date().toISOString();

    // Get user_profiles settings for credit tracking
    const settingsRow = await d1
      .prepare('SELECT settings FROM user_profiles WHERE user_id = ?')
      .bind(user.id)
      .first<{ settings: string | null }>();

    let settings: Record<string, unknown> = {};
    try {
      if (settingsRow?.settings) settings = JSON.parse(settingsRow.settings) as Record<string, unknown>;
    } catch {
      // ignore parse errors
    }

    // Store downgrade as end-of-cycle pending change
    settings.tier_change_request = {
      target_tier: targetTier,
      timing: 'end_of_cycle',
      requested_at: Math.floor(Date.now() / 1000),
      from_tier: currentTier,
    };

    // Store prorated credit for the unused portion of the current period
    if (proratedAmount > 0) {
      const existingCredit = (settings.account_credit_cents as number) ?? 0;
      settings.account_credit_cents = existingCredit + proratedAmount;
      settings.last_credit_reason = `pro_rata_downgrade_${currentTier}_to_${targetTier}`;
      settings.last_credit_at = Math.floor(Date.now() / 1000);
    }

    await d1.batch([
      d1.prepare('UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE org_id = ?')
        .bind(now, orgId),
      d1.prepare(
        `INSERT INTO tier_change_events (user_id, org_id, from_tier, to_tier, event_type)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(user.id, orgId, currentTier, targetTier, 'pending_downgrade'),
      d1.prepare('UPDATE user_profiles SET settings = ?, updated_at = ? WHERE user_id = ?')
        .bind(JSON.stringify(settings), now, user.id),
    ]);

    logger.info('[ChangeTier] Downgrade scheduled', {
      userId: user.id,
      orgId,
      from: currentTier,
      to: targetTier,
      proratedAmount,
      effectiveDate,
    });

    return success({
      newTier: targetTier,
      proratedAmount,
      effectiveDate,
    });
  } catch (err) {
    logger.error('[ChangeTier] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
