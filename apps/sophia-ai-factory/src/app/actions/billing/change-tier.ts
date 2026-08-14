'use server';

/**
 * Billing Actions — Tier Management
 *
 * Consolidated server actions for tier upgrades/downgrades.
 * Moved from app/[locale]/dashboard/billing/actions.ts
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
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

const VALID_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

// ---------------------------------------------------------------------------
// changeTierAction
// ---------------------------------------------------------------------------

/**
 * Provisions a tier change atomically in D1.
 *
 * - Immediate: updates subscriptions + organizations + calculates pro-rata credit
 * - End-of-cycle: stores pending request for cron pickup at period end
 * - MASTER tier requires separate payment flow (rejected here)
 *
 * @param targetTier - Target tier (BASIC, PREMIUM, ENTERPRISE, MASTER)
 * @param timing - When to apply the change
 * @returns Result with credit amount if downgrade
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
