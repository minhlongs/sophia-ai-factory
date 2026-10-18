/**
 * Sunday Weekly Inngest Cron Runner for Payout Batcher
 * @module forest/jobs/payout-batcher/payout-batcher-cron
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import type { PayoutRail, PayoutBatchResult } from './types';

export function createPayoutBatcherCron(
  runBatch: (
    db: D1Database,
    rail?: PayoutRail,
    nowMs?: number,
  ) => Promise<PayoutBatchResult>,
) {
  return inngest.createFunction(
    {
      id: 'payout-batcher-weekly',
      name: 'Payout Batcher — Weekly Sunday',
    },
    { cron: '0 12 * * 0' },
    async ({ step }) => {
      const db = await getD1();
      if (!db) throw new Error('D1 database binding not available');

      const result = await step.run('execute-batch-payout', async () => {
        return runBatch(db, 'nowpayments_usdt');
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
}
