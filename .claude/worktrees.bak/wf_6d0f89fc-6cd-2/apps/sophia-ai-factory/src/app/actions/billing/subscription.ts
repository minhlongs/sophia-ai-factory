'use server';

/**
 * Billing Actions — Subscription Management
 *
 * Consolidated server actions for subscription cancellation and refund queries.
 * Moved from app/[locale]/dashboard/billing/actions.ts
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient, getD1 } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import { logger } from '@/seed/utils/logger-utility';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

const REFUND_WINDOW_DAYS = 30;
const SECONDS_PER_DAY = 86_400;

// ---------------------------------------------------------------------------
// cancelSubscriptionAction
// ---------------------------------------------------------------------------

/**
 * Records a cancellation request in user_profiles settings.
 *
 * Supports:
 * - end_of_cycle: plan stays active until period end
 * - immediate: subscription cancelled immediately (access until period end)
 *
 * Actual deactivation handled by billing ops/cron.
 *
 * @param mode - Cancellation timing mode
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
 * Returns user's one-time purchases eligible for refund.
 *
 * Eligibility:
 * - Within 30-day refund window
 * - Status = 'paid'
 * - No existing refund request
 *
 * Used by billing page to show refundable purchases.
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

    const purchases = (result.results ?? []).map((row) => {
      const purchaseEpoch = row.paid_at ?? row.created_at;
      const daysSince = (nowSec - purchaseEpoch) / SECONDS_PER_DAY;
      return {
        ...row,
        days_remaining: Math.max(0, Math.ceil(REFUND_WINDOW_DAYS - daysSince)),
      };
    });

    return purchases;
  } catch (err) {
    logger.error('[listRefundablePurchases] Failed', err instanceof Error ? err : undefined);
    return [];
  }
}

// ---------------------------------------------------------------------------
// reinstateSubscriptionAction (placeholder for future)
// ---------------------------------------------------------------------------

/**
 * Reinstate a cancelled subscription.
 *
 * Future: implement when user can restart cancelled subscription.
 */
export async function reinstateSubscriptionAction(): Promise<CancelSubscriptionResult> {
  // Not implemented yet — will be added when needed
  return { success: false, error: 'not_implemented' };
}
