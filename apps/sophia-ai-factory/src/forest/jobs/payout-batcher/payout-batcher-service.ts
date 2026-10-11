import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  MIN_PAYOUT_THRESHOLD_CENTS,
  type PayoutRail,
  type PayoutBatchResult,
  type PayableCommissionRow,
} from './types';
import { executeRailPayout } from './batch-collector';
import { createBatchRecord, rollbackBatch } from './payout-state-machine';

/**
 * Programmatic batch payout processor.
 * Scans commission_ledger, claims rows using OCC CAS, inserts batch, dispatches rail,
 * and performs atomic rollback on rail error.
 */
export async function processPayoutBatch(
  db: D1Database,
  rail: PayoutRail = 'nowpayments_usdt',
  nowMs = Date.now(),
): Promise<PayoutBatchResult> {
  const batchId = `batch_${rail}_${nowMs}`;

  let payableRows: PayableCommissionRow[] = [];
  try {
    const result = await db
      .prepare(
        `SELECT id, affiliate_id, commission_cents
         FROM commission_ledger
         WHERE status = 'payable' AND payout_batch_id IS NULL`,
      )
      .all<PayableCommissionRow>();
    payableRows = result.results ?? [];
  } catch (err) {
    logger.error('[PayoutBatcher] Failed to query payable rows', err instanceof Error ? err : new Error(String(err)));
    return {
      success: false,
      batchId,
      totalAmountCents: 0,
      recipientCount: 0,
      claimedRowIds: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (payableRows.length === 0) {
    return {
      success: true,
      batchId,
      totalAmountCents: 0,
      recipientCount: 0,
      claimedRowIds: [],
    };
  }

  const claimedRowIds: string[] = [];
  let totalAmountCents = 0;
  const uniqueRecipients = new Set<string>();

  for (const row of payableRows) {
    if (row.commission_cents >= MIN_PAYOUT_THRESHOLD_CENTS) {
      try {
        const claimResult = await db
          .prepare(
            `UPDATE commission_ledger
             SET status = 'paying', payout_batch_id = ?
             WHERE id = ? AND status = 'payable' AND payout_batch_id IS NULL`,
          )
          .bind(batchId, row.id)
          .run();

        if ((claimResult.meta?.changes ?? 0) > 0) {
          claimedRowIds.push(row.id);
          totalAmountCents += row.commission_cents;
          uniqueRecipients.add(row.affiliate_id);
        }
      } catch (claimErr) {
        logger.warn('[PayoutBatcher] CAS claim error on row', { rowId: row.id, error: String(claimErr) });
      }
    }
  }

  if (claimedRowIds.length === 0) {
    return {
      success: true,
      batchId,
      totalAmountCents: 0,
      recipientCount: 0,
      claimedRowIds: [],
    };
  }

  await createBatchRecord(db, batchId, rail, totalAmountCents, uniqueRecipients.size, nowMs);

  try {
    const dispatch = await executeRailPayout(batchId, totalAmountCents, rail);

    return {
      success: true,
      batchId,
      totalAmountCents,
      recipientCount: uniqueRecipients.size,
      claimedRowIds,
      externalPaymentId: dispatch.externalPaymentId,
    };
  } catch (dispatchErr) {
    logger.error(
      '[PayoutBatcher] Rail dispatch error, rolling back claimed rows',
      dispatchErr instanceof Error ? dispatchErr : new Error(String(dispatchErr)),
      { batchId, claimedCount: claimedRowIds.length },
    );

    await rollbackBatch(db, batchId);

    return {
      success: false,
      batchId,
      totalAmountCents,
      recipientCount: uniqueRecipients.size,
      claimedRowIds,
      error: dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr),
    };
  }
}

/**
 * Sunday weekly Inngest cron job (0 12 * * 0)
 */
export const payoutBatcher = inngest.createFunction(
  {
    id: 'payout-batcher-weekly',
    name: 'Payout Batcher — Weekly Sunday',
  },
  { cron: '0 12 * * 0' },
  async ({ step }) => {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');

    const result = await step.run('execute-batch-payout', async () => {
      return processPayoutBatch(db, 'nowpayments_usdt');
    });

    if (result.claimedRowIds.length > 0) {
      await step.sendEvent('emit-payout-batched', {
        name: 'payout.batched',
        data: {
          batchId: result.batchId,
          affiliateId: 'multi_recipient',
          totalCents: result.totalAmountCents,
          externalPaymentId: result.externalPaymentId ?? `ext_${result.batchId}`,
        },
      });
    }

    return result;
  },
);
