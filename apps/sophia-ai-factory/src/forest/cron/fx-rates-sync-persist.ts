/**
 * FX Rates persistence helpers.
 * Layer: forest/cron
 * @module forest/cron/fx-rates-sync-persist
 */

import type { D1Database } from '@/seed/db/client';
import { ALL_SUPPORTED_CURRENCIES } from '@/seed/types/enterprise-billing';
import { DEFAULT_HEDGING_BUFFER_PERCENT } from '@/tree/fx/fx-hedging-engine';

export async function persistFxRatesToD1(
  db: D1Database,
  rates: Record<string, number>,
  sourceProvider: string,
  fetchedAt: number,
): Promise<number> {
  const nowSec = Math.floor(fetchedAt / 1000);
  const validUntilSec = nowSec + 3600;
  let updatedCount = 0;

  for (const currency of ALL_SUPPORTED_CURRENCIES) {
    const rate = rates[currency];
    if (typeof rate !== 'number' || rate <= 0) continue;

    const inverseRate = rate > 0 ? 1 / rate : 1.0;
    const bufferPercentage = currency === 'USD' ? 0.0 : DEFAULT_HEDGING_BUFFER_PERCENT;
    const hedgedRate = rate * (1 + bufferPercentage);

    await db
      .prepare(
        `UPDATE fx_exchange_rates
         SET is_active = 0
         WHERE base_currency = 'USD' AND target_currency = ?1 AND is_active = 1`,
      )
      .bind(currency)
      .run();

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

  return updatedCount;
}