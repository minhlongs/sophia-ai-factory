/**
 * FX Rates Synchronization Cron Worker
 *
 * Synchronizes real-time exchange rates across all 10 supported currencies into
 * Cloudflare KV and D1 `fx_exchange_rates` ledger.
 *
 * Runs periodically (hourly or via cron trigger) to update market rates and calculate
 * hedged rates with the +1.5% volatility buffer reserve.
 *
 * Layer: forest/cron (Infrastructure orchestrator — imports only from seed, tree, and sibling forest)
 *
 * @module forest/cron/fx-rates-sync-cron
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { fetchMultiTierRates } from '@/tree/fx/fx-hedging-engine';
import { recordCronRun, wasRecentlyRun } from '@/tree/cron/run-tracker';
import { persistFxRatesToD1 } from './fx-rates-sync-persist';

const CRON_JOB_NAME = 'fx_rates_sync';
const MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface FxSyncCronResult {
  success: boolean;
  ratesUpdated: number;
  sourceProvider: string;
  skipped?: boolean;
  error?: string;
}

export async function runFxRatesSyncCron(
  db: D1Database,
  env?: Record<string, unknown>,
): Promise<FxSyncCronResult> {
  try {
    const recentlyRun = await wasRecentlyRun(db, CRON_JOB_NAME, MIN_INTERVAL_MS);
    if (recentlyRun) {
      logger.info('[FxRatesSyncCron] Cron ran recently, skipping execution');
      return { success: true, ratesUpdated: 0, sourceProvider: 'SKIPPED', skipped: true };
    }

    logger.info('[FxRatesSyncCron] Starting FX rates sync');

    const { rates, sourceProvider, fetchedAt } = await fetchMultiTierRates(env);
    const updatedCount = await persistFxRatesToD1(db, rates, sourceProvider, fetchedAt);

    await recordCronRun(db, CRON_JOB_NAME, 'success');
    logger.info('[FxRatesSyncCron] Completed FX rates sync', { updatedCount, sourceProvider });

    return { success: true, ratesUpdated: updatedCount, sourceProvider };
  } catch (err) {
    const error = toError(err);
    logger.error('[FxRatesSyncCron] FX rates sync failed', error);
    await recordCronRun(db, CRON_JOB_NAME, 'failure', error.message);
    return { success: false, ratesUpdated: 0, sourceProvider: 'ERROR', error: error.message };
  }
}