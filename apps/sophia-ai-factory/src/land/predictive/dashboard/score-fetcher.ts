'use server';

/**
 * Score Fetcher Action for Predictive Dashboard
 *
 * @module land/predictive/dashboard/score-fetcher
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  CustomerPredictiveScore,
} from '@/seed/types/predictive-expansion';
import { getLatestCustomerPredictiveScore } from '@/tree/predictive/predictive-ltv-engine';

export async function getCustomerPredictiveScoreAction(
  customerId: string,
): Promise<ActionResult<CustomerPredictiveScore>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const score = await getLatestCustomerPredictiveScore(db, customerId);
    if (!score) {
      return { success: false, error: 'No predictive score found for customer' };
    }

    return { success: true, data: score };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[predictive-actions] getCustomerPredictiveScoreAction error', {
      error: message,
    });
    return { success: false, error: message };
  }
}
