import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  HedgingReconciliationResult,
} from '@/seed/types/fx-hedging';
import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import { reconcileSettlementSlippage } from '@/tree/fx/fx-hedging-engine';
import type { HedgingAdminError } from './types';
import { assertAdmin } from './currency-risk-calculator';

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
