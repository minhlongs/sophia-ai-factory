import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  type PayoutRail,
  type PayoutBatchResult,
} from './types';
import { executeRailPayout } from './batch-collector';
import { createBatchRecord, rollbackBatch } from './payout-state-machine';
import {
  queryPayableCommissions,
  claimPayableRows,
  type ClaimedCommissionsSummary,
} from './payout-batcher-claims';

export {
  queryPayableCommissions,
  claimPayableRows,
  type ClaimedCommissionsSummary,
};

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

  const { rows: payableRows, error: queryError } = await queryPayableCommissions(db);
  if (queryError) {
    return {
      success: false,
      batchId,
      totalAmountCents: 0,
      recipientCount: 0,
      claimedRowIds: [],
      error: queryError,
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

  const { claimedRowIds, totalAmountCents, recipientCount } = await claimPayableRows(
    db,
    batchId,
    payableRows,
  );

  if (claimedRowIds.length === 0) {
    return {
      success: true,
      batchId,
      totalAmountCents: 0,
      recipientCount: 0,
      claimedRowIds: [],
    };
  }

  await createBatchRecord(db, batchId, rail, totalAmountCents, recipientCount, nowMs);

  try {
    const dispatch = await executeRailPayout(batchId, totalAmountCents, rail);

    return {
      success: true,
      batchId,
      totalAmountCents,
      recipientCount,
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
      recipientCount,
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
