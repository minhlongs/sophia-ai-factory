/**
 * Customer Active Subscription Lookup (User & Org Scoped).
 *
 * @module land/billing/customer-subscription-query
 */

import { createServerClient } from '@/seed/db/client';
import { normalizePlanToTier } from '@/seed/db/get-user-tier';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Tier } from '@/seed/types';

interface RawSubscriptionRow {
  tier: string | null;
  plan: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: number | null;
}

interface RawOrgSubRow {
  tier: string | null;
  plan: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface ActiveCustomerSubscriptionInfo {
  resolvedTier: Tier;
  subStatus: string;
  periodEnd: string | null;
}

export async function queryActiveCustomerSubscription(
  userId: string,
): Promise<ActiveCustomerSubscriptionInfo> {
  let resolvedTier: Tier = 'BASIC';
  let subStatus = 'active';
  let periodEnd: string | null = null;

  try {
    const db = createServerClient();

    // 1. Check user-scoped active subscription first
    const userSub = await db
      .prepare(
        `SELECT tier, plan, status, current_period_start, current_period_end, trial_ends_at
         FROM subscriptions
         WHERE user_id = ?1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first<RawSubscriptionRow>();

    if (userSub) {
      resolvedTier = normalizePlanToTier(userSub.tier ?? userSub.plan);
      subStatus = userSub.status ?? 'active';
      periodEnd = userSub.current_period_end;
    } else {
      // 2. Check org-level active subscription for org members
      const orgSub = await db
        .prepare(
          `SELECT s.tier, s.plan, s.status, s.current_period_start, s.current_period_end
           FROM org_members om
           JOIN subscriptions s ON s.org_id = om.org_id
           WHERE om.user_id = ?1 AND s.status = 'active'
           ORDER BY s.created_at DESC LIMIT 1`,
        )
        .bind(userId)
        .first<RawOrgSubRow>();

      if (orgSub) {
        resolvedTier = normalizePlanToTier(orgSub.tier ?? orgSub.plan);
        subStatus = orgSub.status ?? 'active';
        periodEnd = orgSub.current_period_end;
      }
    }
  } catch (err) {
    logger.warn('[CustomerUsagePlan] Fallback to BASIC tier due to DB error', {
      userId,
      error: toError(err).message,
    });
  }

  return { resolvedTier, subStatus, periodEnd };
}
