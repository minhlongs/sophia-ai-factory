'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { revalidatePath } from 'next/cache';
import { logger } from '@/seed/utils/logger-utility';
import type { CancelSubscriptionResult } from './types';

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
