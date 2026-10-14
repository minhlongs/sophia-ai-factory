'use server';

/**
 * Expansion Actions for Predictive Dashboard
 *
 * @module land/predictive/dashboard/expansion-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  ExpansionRecommendation,
} from '@/seed/types/predictive-expansion';
import {
  applyExpansionRecommendation,
  getActiveRecommendationsForCustomer,
} from '@/tree/predictive/account-expansion-engine';

export async function getActiveRecommendationsAction(
  customerId: string,
): Promise<ActionResult<ExpansionRecommendation[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const recommendations = await getActiveRecommendationsForCustomer(
      db,
      customerId,
    );
    return { success: true, data: recommendations };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      '[predictive-actions] getActiveRecommendationsAction error',
      { error: message },
    );
    return { success: false, error: message };
  }
}

export async function applyExpansionRecommendationAction(
  recommendationId: string,
): Promise<ActionResult<{ success: boolean; appliedAt: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const result = await applyExpansionRecommendation(db, recommendationId);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      '[predictive-actions] applyExpansionRecommendationAction error',
      { error: message },
    );
    return { success: false, error: message };
  }
}
