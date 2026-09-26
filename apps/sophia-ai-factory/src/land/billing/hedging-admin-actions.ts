/**
 * FX Hedging & Reserve Administration Server Actions
 *
 * Provides administrative Server Actions for:
 * 1. Viewing active FX exchange rates and volatility buffer status
 * 2. Monitoring FX hedging reserve escrows and total realized PnL
 * 3. Reconciling settlement slippage when localized payment clears
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/* (NO @/forest imports)
 *
 * @module land/billing/hedging-admin-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type FxRateRecord,
  type HedgingReserveRecord,
  type HedgingReconciliationResult,
} from '@/seed/types/fx-hedging';
import { type SupportedCurrency } from '@/seed/types/enterprise-billing';
import { reconcileSettlementSlippage } from '@/tree/fx/fx-hedging-engine';

export interface HedgingAdminError {
  code: string;
  message: string;
}

export interface FxReservesSummary {
  totalEscrowedCents: number;
  totalRealizedPnlCents: number;
  escrowedCount: number;
  realizedGainCount: number;
  absorbedLossCount: number;
  rebalancedCount: number;
  totalCount: number;
}

/**
 * Asserts that the caller is a platform administrator.
 */
async function assertAdmin(): Promise<Result<string, HedgingAdminError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin) {
    return failure({ code: 'FORBIDDEN', message: 'Platform admin privilege required' });
  }

  return success(user.id);
}

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

/**
 * Reconciles market slippage upon payment settlement and updates escrow status.
 */
export async function reconcileTransactionSlippageAction(
  transactionId: string,
  settlementMarketRate: number,
): Promise<Result<HedgingReconciliationResult, HedgingAdminError>> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  try {
    const db = getD1() as unknown as D1Database;
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database service is unavailable' });
    }

    // 1. Fetch reserve record and transaction details
    const reserve = await db
      .prepare(
        `SELECT
           r.id, r.transaction_id, r.target_currency, r.base_amount_cents,
           r.market_rate_at_quote, r.hedged_rate_at_quote, r.reserve_status,
           t.total_amount
         FROM fx_hedging_reserves r
         JOIN localized_payment_transactions t ON t.id = r.transaction_id
         WHERE r.transaction_id = ?1
         LIMIT 1`,
      )
      .bind(transactionId)
      .first<{
        id: string;
        transaction_id: string;
        target_currency: SupportedCurrency;
        base_amount_cents: number;
        market_rate_at_quote: number;
        hedged_rate_at_quote: number;
        reserve_status: string;
        total_amount: number;
      }>();

    if (!reserve) {
      return failure({ code: 'NOT_FOUND', message: `No reserve found for transaction: ${transactionId}` });
    }

    // 2. Perform slippage calculation
    const reconciliation = reconcileSettlementSlippage({
      transactionId,
      reserveId: reserve.id,
      baseAmountCents: reserve.base_amount_cents,
      quotedMarketRate: reserve.market_rate_at_quote,
      quotedHedgedRate: reserve.hedged_rate_at_quote,
      settlementMarketRate,
      targetAmount: reserve.total_amount,
      targetCurrency: reserve.target_currency,
    });

    const nowSec = Math.floor(Date.now() / 1000);

    // 3. Update fx_hedging_reserves table
    await db
      .prepare(
        `UPDATE fx_hedging_reserves
         SET market_rate_at_settlement = ?1,
             variance_percent = ?2,
             realized_pnl_cents = ?3,
             reserve_status = ?4,
             settled_at = ?5,
             updated_at = ?5
         WHERE id = ?6`,
      )
      .bind(
        settlementMarketRate,
        reconciliation.slippagePercent,
        reconciliation.realizedPnlCents,
        reconciliation.finalStatus,
        nowSec,
        reserve.id,
      )
      .run();

    // 4. Update transaction status to completed
    await db
      .prepare(
        `UPDATE localized_payment_transactions
         SET status = 'completed',
             settled_at = ?1,
             updated_at = ?1
         WHERE id = ?2`,
      )
      .bind(nowSec, transactionId)
      .run();

    logger.info('[HedgingAdminActions] Reconciled transaction slippage', {
      transactionId,
      finalStatus: reconciliation.finalStatus,
      pnlCents: reconciliation.realizedPnlCents,
    });

    return success(reconciliation);
  } catch (err) {
    const error = toError(err);
    logger.error('[HedgingAdminActions] Slippage reconciliation failed', error);
    return failure({ code: 'RECONCILIATION_FAILED', message: error.message });
  }
}
