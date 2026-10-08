/**
 * @file affiliate-epc-copilot-job.ts
 * @description Inngest background job orchestrating Affiliate EPC tier updates
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';

export const affiliateEpcCopilotJob = inngest.createFunction(
  {
    id: 'affiliate-epc-copilot-job',
    name: 'Affiliate EPC Co-Pilot Scaler',
    concurrency: { limit: 5 },
  },
  { event: 'affiliate.deal.matched' },
  async ({ event, step }) => {
    const { userId, recordId, campaignId, calculatedEpc, tier } = event.data;

    await step.run('log-tier-escalation', async () => {
      const db = createServerClient();
      await db
        .prepare(
          `UPDATE affiliate_epc_records
           SET commission_tier = ?
           WHERE id = ?`
        )
        .bind(tier, recordId)
        .run();
    });

    return {
      status: 'ESCALATED',
      userId,
      campaignId,
      calculatedEpc,
      tier,
    };
  }
);
