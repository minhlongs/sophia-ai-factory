/**
 * Financial Reconciliation Job
 *
 * Layer: forest (orchestration / Inngest scheduled workflows)
 *
 * Requirements:
 * 1. Daily audit job comparing ledger claims against external rail confirmations.
 * 2. Compares ledger claimed amount vs external confirmed amount.
 * 3. Reconciled (diff <= 100 cents / $1.00) -> marks status = 'confirmed' and commission_ledger rows = 'paid'.
 * 4. Unreconciled (diff > 100 cents) -> marks status = 'reconciliation_failed' and triggers alert.
 * 5. Runs: 0 4 * * * (04:00 UTC daily) + programmatic execution.
 *
 * @module forest/jobs/financial-reconciliation
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import {
  reconcileDailyFinancials,
  runDailyFinancialReconciliation,
  type ReconciliationResult,
  type ReconciliationSweepReport,
} from './financial-reconciliation-core';

export {
  reconcileDailyFinancials,
  runDailyFinancialReconciliation,
  type ReconciliationResult,
  type ReconciliationSweepReport,
};

/**
 * Daily 04:00 UTC Inngest scheduled cron job
 */
export const financialReconciliationCron = inngest.createFunction(
  {
    id: 'financial-reconciliation-daily',
    name: 'Financial Reconciliation — Daily',
  },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');

    const report = await step.run('sweep-and-reconcile-batches', async () => {
      return runDailyFinancialReconciliation(db);
    });

    if (report.failedCount > 0) {
      const failedResult = report.results.find((r) => !r.isReconciled);
      await step.sendEvent('emit-reconciliation-alert', {
        name: 'payout.reconcile.alert',
        data: {
          tenantId: 'sophia-global',
          ledgerTotalCents: failedResult?.ledgerClaimedCents ?? 0,
          batchTotalCents: failedResult?.externalConfirmedCents ?? 0,
          diffCents: failedResult?.diffCents ?? 0,
        },
      });
    }

    return report;
  },
);
