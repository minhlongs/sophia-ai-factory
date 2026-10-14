'use server';

/**
 * Investor Relations Monte Carlo Forecast Actions
 *
 * @module land/predictive/dashboard/forecast-actions
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  InvestorRelationsForecastReport,
  MonteCarloSimulationInput,
} from '@/seed/types/predictive-expansion';
import {
  runMonteCarloIRSimulation,
  saveInvestorRelationsForecastBatch,
} from '@/tree/predictive/predictive-ltv-engine';

export async function generateInvestorRelationsForecastAction(
  input: MonteCarloSimulationInput,
): Promise<ActionResult<InvestorRelationsForecastReport>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const { slices, report } = runMonteCarloIRSimulation(input);
    await saveInvestorRelationsForecastBatch(db, slices);

    return { success: true, data: report };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      '[predictive-actions] generateInvestorRelationsForecastAction error',
      { error: message },
    );
    return { success: false, error: message };
  }
}
