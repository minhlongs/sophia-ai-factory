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
import {
  type SupportedCurrency,
  ALL_SUPPORTED_CURRENCIES,
} from '@/seed/types/enterprise-billing';
import {
  fetchMultiTierRates,
  DEFAULT_HEDGING_BUFFER_PERCENT,
} from '@/tree/fx/fx-hedging-engine';
import { recordCronRun, wasRecentlyRun } from './run-tracker';

const CRON_JOB_NAME = 'fx_rates_sync';
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5-minute debounce

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
    // 1. Idempotency guard: prevent duplicate runs within 5 minutes
    const recentlyRun = await wasRecentlyRun(db, CRON_JOB_NAME, MIN_INTERVAL_MS);
    if (recentlyRun) {
      logger.info('[FxRatesSyncCron] Cron ran recently, skipping execution');
      return {
        success: true,
        ratesUpdated: 0,
        sourceProvider: 'SKIPPED',
        skipped: true,
      };
    }

    logger.info('[FxRatesSyncCron] Starting FX rates sync');

    // 2. Fetch multi-tier rates
    const { rates, sourceProvider, fetchedAt } = await fetchMultiTierRates(env);

    const nowSec = Math.floor(fetchedAt / 1000);
    const validUntilSec = nowSec + 3600; // 1 hour validity

    let updatedCount = 0;

    // 3. Persist rates to D1 in batch
    for (const currency of ALL_SUPPORTED_CURRENCIES) {
      const rate = rates[currency];
      if (typeof rate !== 'number' || rate <= 0) continue;

      const inverseRate = rate > 0 ? 1 / rate : 1.0;
      const bufferPercentage = currency === 'USD' ? 0.0 : DEFAULT_HEDGING_BUFFER_PERCENT;
      const hedgedRate = rate * (1 + bufferPercentage);

      // Deactivate older active rates for this currency
      await db
        .prepare(
          `UPDATE fx_exchange_rates
           SET is_active = 0
           WHERE base_currency = 'USD' AND target_currency = ?1 AND is_active = 1`,
        )
        .bind(currency)
        .run();

      // Insert new exchange rate snapshot
      await db
        .prepare(
          `INSERT INTO fx_exchange_rates (
             base_currency, target_currency, rate, inverse_rate,
             buffer_percentage, hedged_rate, source_provider,
             is_active, valid_from, valid_until, created_at
           ) VALUES (
             'USD', ?1, ?2, ?3,
             ?4, ?5, ?6,
             1, ?7, ?8, ?9
           )`,
        )
        .bind(
          currency,
          rate,
          inverseRate,
          bufferPercentage,
          hedgedRate,
          sourceProvider,
          nowSec,
          validUntilSec,
          nowSec,
        )
        .run();

      updatedCount++;
    }

    await recordCronRun(db, CRON_JOB_NAME, 'success');
    logger.info('[FxRatesSyncCron] Completed FX rates sync', {
      updatedCount,
      sourceProvider,
    });

    return {
      success: true,
      ratesUpdated: updatedCount,
      sourceProvider,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[FxRatesSyncCron] FX rates sync failed', error);
    await recordCronRun(db, CRON_JOB_NAME, 'failure', error.message);
    return {
      success: false,
      ratesUpdated: 0,
      sourceProvider: 'ERROR',
      error: error.message,
    };
  }
}
