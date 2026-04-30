/**
 * Pending Promoter Cron — Inngest daily cron
 *
 * Flips commission_ledger rows from pending → payable
 * where payable_at <= now AND status = 'pending'.
 * Runs: 0 2 * * * (02:00 UTC daily)
 *
 * @module payouts/pending-promoter-cron
 */

import { inngest } from '@/lib/inngest/client'
import { flipPendingToPayable } from './commission-ledger'

export const pendingPromoterCron = inngest.createFunction(
  {
    id: 'pending-promoter-daily',
    name: 'Pending → Payable Promoter — Daily',
  },
  { cron: '0 2 * * *' },
  async ({ step }) => {
    const nowTs = Math.floor(Date.now() / 1000)

    const updated = await step.run('flip-pending-to-payable', async () => {
      return flipPendingToPayable(nowTs)
    })

    // Emit commission.matured event for downstream processing
    if (updated > 0) {
      await step.sendEvent('emit-commission-matured', {
        name: 'commission.matured',
        data: { updatedCount: updated, promotedAt: nowTs },
      })
    }

    return { updatedCount: updated, promotedAt: nowTs }
  },
)
