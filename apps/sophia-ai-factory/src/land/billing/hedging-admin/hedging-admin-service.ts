import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { FxRateRecord } from '@/seed/types/fx-hedging';
import type { HedgingAdminError, FxReservesSummary } from './types';
import { assertAdmin } from './currency-risk-calculator';

/**
 * Retrieves all currently active FX exchange rates across 10 currencies.
 */
export async function getActiveFxRatesAction(): Promise<
  Result<FxRateRecord[], HedgingAdminError>
> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  try {
    const db = getD1() as unknown as D1Database;
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database service is unavailable' });
    }

    const { results } = await db
      .prepare(
        `SELECT
           id, base_currency as baseCurrency, target_currency as targetCurrency,
           rate, inverse_rate as inverseRate, buffer_percentage as bufferPercentage,
           hedged_rate as hedgedRate, source_provider as sourceProvider,
           is_active as isActive, valid_from as validFrom, valid_until as validUntil,
           created_at as createdAt
         FROM fx_exchange_rates
         WHERE is_active = 1
         ORDER BY target_currency ASC`,
      )
      .all<FxRateRecord>();

    return success(results ?? []);
  } catch (err) {
    const error = toError(err);
    logger.error('[HedgingAdminActions] Failed to fetch active FX rates', error);
    return failure({ code: 'FETCH_FAILED', message: error.message });
  }
}

/**
 * Computes aggregate summary metrics for FX hedging reserves.
 */
export async function getFxReservesSummaryAction(): Promise<
  Result<FxReservesSummary, HedgingAdminError>
> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  try {
    const db = getD1() as unknown as D1Database;
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database service is unavailable' });
    }

    const rows = await db
      .prepare(
        `SELECT
           reserve_status,
           COUNT(*) as cnt,
           SUM(reserve_amount_cents) as total_escrowed,
           SUM(COALESCE(realized_pnl_cents, 0)) as total_pnl
         FROM fx_hedging_reserves
         GROUP BY reserve_status`,
      )
      .all<{
        reserve_status: string;
        cnt: number;
        total_escrowed: number | null;
        total_pnl: number | null;
      }>();

    const summary: FxReservesSummary = {
      totalEscrowedCents: 0,
      totalRealizedPnlCents: 0,
      escrowedCount: 0,
      realizedGainCount: 0,
      absorbedLossCount: 0,
      rebalancedCount: 0,
      totalCount: 0,
    };

    for (const r of rows.results ?? []) {
      const count = Number(r.cnt) || 0;
      summary.totalCount += count;

      if (r.reserve_status === 'escrowed') {
        summary.escrowedCount += count;
        summary.totalEscrowedCents += Number(r.total_escrowed) || 0;
      } else if (r.reserve_status === 'realized_gain') {
        summary.realizedGainCount += count;
        summary.totalRealizedPnlCents += Number(r.total_pnl) || 0;
      } else if (r.reserve_status === 'absorbed_loss') {
        summary.absorbedLossCount += count;
        summary.totalRealizedPnlCents += Number(r.total_pnl) || 0;
      } else if (r.reserve_status === 'rebalanced') {
        summary.rebalancedCount += count;
        summary.totalRealizedPnlCents += Number(r.total_pnl) || 0;
      }
    }

    return success(summary);
  } catch (err) {
    const error = toError(err);
    logger.error('[HedgingAdminActions] Failed to fetch reserve summary', error);
    return failure({ code: 'SUMMARY_FAILED', message: error.message });
  }
}
