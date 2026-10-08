/**
 * @file b2b-outreach-warmup-job.ts
 * @description Inngest background job orchestrating B2B outreach warmup ramps & domain validation
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import {
  calculateWarmupDailyVolume,
  isCorporateDomain,
} from '@/tree/outreach/b2b-warmup-engine';

export const b2bOutreachWarmupJob = inngest.createFunction(
  {
    id: 'b2b-outreach-warmup-job',
    name: 'B2B Outreach Warmup & Validation Job',
    concurrency: { limit: 5 },
  },
  { event: 'b2b.outreach.dispatched' },
  async ({ event, step }) => {
    const { leadId, userId, email, channel, rampDay, intentScore } = event.data;

    // Step 1: Validate Corporate Domain
    const domainValid = await step.run('validate-domain', async () => {
      const domain = email.split('@')[1] || '';
      return {
        domain,
        isCorporate: isCorporateDomain(domain),
      };
    });

    if (!domainValid.isCorporate) {
      await step.run('mark-non-corporate', async () => {
        const db = createServerClient();
        await db
          .prepare(
            `UPDATE b2b_lead_records
             SET is_corporate_domain = 0, status = 'BOUNCED', updated_at = ?
             WHERE id = ?`
          )
          .bind(Date.now(), leadId)
          .run();
      });
      return { status: 'REJECTED_NON_CORPORATE', leadId };
    }

    // Step 2: Compute Daily Ramp Volume
    const rampVolume = await step.run('compute-ramp-volume', async () => {
      const allowedVolume = calculateWarmupDailyVolume(rampDay);
      return { allowedVolume };
    });

    // Step 3: Advance State to CONTACTED
    await step.run('advance-lead-state', async () => {
      const db = createServerClient();
      await db
        .prepare(
          `UPDATE b2b_lead_records
           SET status = 'CONTACTED', last_contacted_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(Date.now(), Date.now(), leadId)
        .run();
    });

    return {
      success: true,
      leadId,
      channel,
      rampVolume: rampVolume.allowedVolume,
      status: 'CONTACTED',
    };
  }
);
