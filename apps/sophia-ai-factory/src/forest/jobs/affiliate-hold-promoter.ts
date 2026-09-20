/**
 * Affiliate 14-Day Hold Promotion Job
 *
 * Layer: forest (orchestration / Inngest scheduled workflows)
 *
 * Daily job scanning commission_ledger for pending commissions
 * whose 14-day anti-fraud hold has matured (payable_at <= nowMs).
 * Promotes status to 'payable' and publishes telemetry event.
 *
 * @module forest/jobs/affiliate-hold-promoter
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { flipPendingToPayable } from '@/tree/affiliate/commission-ledger';

export interface HoldPromotionResult {
  promotedCount: number;
  promotedAtMs: number;
}

/**
 * Programmatic runner for tests and manual operational execution.
 */
export async function runHoldPromotionJob(
  db?: D1Database,
  nowTimestampMs = Date.now(),
): Promise<HoldPromotionResult> {
  const d1 = db ?? (await getD1());
  if (!d1) throw new Error('D1 database binding not available');

  const promotedCount = await flipPendingToPayable(d1, nowTimestampMs);
  logger.info('[AffiliateHoldPromoter] Completed hold promotion check', {
    promotedCount,
    promotedAtMs: nowTimestampMs,
  });

  return { promotedCount, promotedAtMs: nowTimestampMs };
}

/**
 * Inngest Scheduled Cron: 02:00 UTC daily
 */
export const affiliateHoldPromoterCron = inngest.createFunction(
  {
    id: 'affiliate-hold-promoter-daily',
    name: 'Affiliate 14-Day Hold Promoter — Daily',
  },
  { cron: '0 2 * * *' },
  async ({ step }) => {
    const nowMs = Date.now();

    const { promotedCount, promotedAtMs } = await step.run(
      'flip-pending-to-payable',
      async () => {
        return runHoldPromotionJob(undefined, nowMs);
      },
    );

    if (promotedCount > 0) {
      await step.sendEvent('emit-commission-matured', {
        name: 'commission.matured',
        data: {
          updatedCount: promotedCount,
          promotedAt: Math.floor(promotedAtMs / 1000),
        },
      });
    }

    return { promotedCount, promotedAtMs };
  },
);

export { flipPendingToPayable };
