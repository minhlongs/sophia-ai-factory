'use server';

/**
 * Server actions for billing self-serve flows:
 *  - changeTierAction  — tier upgrade or downgrade with timing option
 *  - cancelSubscriptionAction — cancel subscription (end-of-cycle or immediate)
 *
 * Refund submission calls the existing API route directly from the client;
 * no server action needed for that path.
 *
 * @module app/[locale]/dashboard/billing/actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeTierTiming = 'immediate' | 'end_of_cycle';

export interface ChangeTierResult {
  success: boolean;
  error?: string;
}

export interface CancelSubscriptionResult {
  success: boolean;
  error?: string;
  /** Epoch seconds when the cancellation takes effect (end-of-cycle) */
  effectiveAt?: number;
}

const VALID_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

// ---------------------------------------------------------------------------
// changeTierAction
// ---------------------------------------------------------------------------

/**
 * Records a tier-change request in user_profiles settings.
 * Actual provisioning is handled by the billing ops workflow.
 *
 * MASTER is one-time purchase — upgrades to MASTER require payment flow;
 * this action handles BASIC/PREMIUM/ENTERPRISE changes only as self-serve.
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
    } catch { /* ignore malformed settings */ }

    settings.tier_change_request = {
      target_tier: targetTier,
      timing,
      requested_at: Math.floor(Date.now() / 1000),
    };

    const { error } = await db
      .from('user_profiles')
      .update({ settings: JSON.stringify(settings), updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (error) {
      logger.error('[changeTierAction] DB update failed', error instanceof Error ? error : undefined);
      return { success: false, error: 'db_error' };
    }

    logger.info('[changeTierAction] Tier change recorded', {
      userId: user.id,
      targetTier,
      timing,
    });
    return { success: true };
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
    return { success: true };
  } catch (err) {
    logger.error('[cancelSubscriptionAction] Unexpected error', err instanceof Error ? err : undefined);
    return { success: false, error: 'internal_error' };
  }
}
