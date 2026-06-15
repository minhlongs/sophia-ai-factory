'use server';

/**
 * Server actions for billing self-serve flows:
 *  - changeTierAction  — tier upgrade or downgrade with atomic D1 provisioning
 *  - cancelSubscriptionAction — cancel subscription (end-of-cycle or immediate)
 *  - listRefundablePurchasesAction — list user's purchases eligible for refund
 *
 * @module app/[locale]/dashboard/billing/actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { revalidatePath } from 'next/cache';
import { logger } from '@/seed/utils/logger-utility';
import { provisionTierChange } from '@/land/billing/tier-change-provisioner';
import type { Tier } from '@/seed/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeTierTiming = 'immediate' | 'end_of_cycle';

export interface ChangeTierResult {
  success: boolean;
  error?: string;
  creditCents?: number;
  effectiveAt?: string;
}

export interface CancelSubscriptionResult {
  success: boolean;
  error?: string;
  /** Epoch seconds when the cancellation takes effect (end-of-cycle) */
  effectiveAt?: number;
}

export interface RefundablePurchase {
  id: string;
  sku: string;
  amount_cents: number;
  status: string;
  created_at: number;
  paid_at: number | null;
  days_remaining: number;
}

const VALID_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
const REFUND_WINDOW_DAYS = 30;
const SECONDS_PER_DAY = 86_400;

// ---------------------------------------------------------------------------
// changeTierAction
// ---------------------------------------------------------------------------

/**
 * Provisions a tier change atomically in D1.
 * Immediate: updates subscriptions + organizations + calculates pro-rata credit.
 * End-of-cycle: stores pending request for cron pickup at period end.
 *
 * MASTER is one-time purchase — upgrades to MASTER require payment flow.
 */
export async function changeTierAction(
  targetTier: Tier,
  timing: ChangeTierTiming,
): Promise<ChangeTierResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!VALID_TIERS.includes(targetTier)) {
    return { success: false, error: 'invalid_tier' };
  }
  if (targetTier === 'MASTER') {
    return { success: false, error: 'master_requires_payment' };
  }

  try {
    const currentTier = await resolveUserTier(user.id);
    if (currentTier === targetTier) {
      return { success: false, error: 'already_on_tier' };
    }

    // Resolve org membership
    const db = createServerClient();
    const { data: membership } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    const orgId = (membership as { org_id?: string } | null)?.org_id;
    if (!orgId) {
      return { success: false, error: 'no_organization' };
    }

    const result = await provisionTierChange({
      userId: user.id,
      orgId,
      currentTier,
      targetTier,
      timing,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    logger.info('[changeTierAction] Tier change provisioned', {
      userId: user.id,
      from: currentTier,
      to: targetTier,
      timing,
      creditCents: result.creditCents,
    });

  revalidatePath('/dashboard/billing');
  revalidatePath('/dashboard');

    return {
      success: true,
      creditCents: result.creditCents,
      effectiveAt: result.effectiveAt,
    };
  } catch (err) {
    logger.error('[changeTierAction] Unexpected error', err instanceof Error ? err : undefined);
    return { success: false, error: 'internal_error' };
  }
}

// ---------------------------------------------------------------------------
// cancelSubscriptionAction
// ---------------------------------------------------------------------------

/**
 * Records a cancellation request in user_profiles settings.
 * Supports end_of_cycle (plan stays active) and immediate cancellation.
 * Actual deactivation handled by billing ops.
 */
export async function cancelSubscriptionAction(
  mode: 'end_of_cycle' | 'immediate',
): Promise<CancelSubscriptionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const db = createServerClient();
    const { data: existing } = await db
      .from('user_profiles')
      .select('settings')
      .eq('user_id', user.id)
      .single();

    let settings: Record<string, unknown> = {};
    try {
      if (existing?.settings) {
        settings = JSON.parse(existing.settings as string) as Record<string, unknown>;
      }
    } catch { /* ignore */ }

    const nowSec = Math.floor(Date.now() / 1000);
    settings.cancel_requested_at = nowSec;
    settings.cancel_mode = mode;

    const { error } = await db
      .from('user_profiles')
      .update({ settings: JSON.stringify(settings), updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      logger.error('[cancelSubscriptionAction] DB update failed', error instanceof Error ? error : undefined);
      return { success: false, error: 'db_error' };
    }

    logger.info('[cancelSubscriptionAction] Cancellation recorded', {
      userId: user.id,
      mode,
    });
  revalidatePath('/dashboard/billing');
    return { success: true };
  } catch (err) {
    logger.error('[cancelSubscriptionAction] Unexpected error', err instanceof Error ? err : undefined);
    return { success: false, error: 'internal_error' };
  }
}

// ---------------------------------------------------------------------------
// listRefundablePurchasesAction
// ---------------------------------------------------------------------------

/**
 * Returns user's one-time purchases eligible for refund (within 30-day window,
 * status = 'paid', no existing refund request).
 */
export async function listRefundablePurchasesAction(): Promise<RefundablePurchase[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - REFUND_WINDOW_DAYS * SECONDS_PER_DAY;

    const result = await db
      .prepare(
        `SELECT p.id, p.sku, p.amount_cents, p.status, p.created_at, p.paid_at
         FROM user_purchases p
         WHERE p.user_id = ?1
           AND p.kind = 'one_time'
           AND p.status = 'paid'
           AND COALESCE(p.paid_at, p.created_at) >= ?2
           AND NOT EXISTS (
             SELECT 1 FROM refund_requests r
             WHERE r.purchase_id = p.id AND r.user_id = p.user_id
           )
         ORDER BY p.created_at DESC
         LIMIT 50`,
      )
      .bind(user.id, cutoff)
      .all<{
        id: string;
        sku: string;
        amount_cents: number;
        status: string;
        created_at: number;
        paid_at: number | null;
      }>();

    return (result.results ?? []).map((row) => {
      const purchaseEpoch = row.paid_at ?? row.created_at;
      const daysSince = (nowSec - purchaseEpoch) / SECONDS_PER_DAY;
      return {
        ...row,
        days_remaining: Math.max(0, Math.ceil(REFUND_WINDOW_DAYS - daysSince)),
      };
    });
  } catch (err) {
    logger.error('[listRefundablePurchases] Failed', err instanceof Error ? err : undefined);
    return [];
  }
}
