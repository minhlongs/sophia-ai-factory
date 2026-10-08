/**
 * @file subscriber-cohort-job.ts
 * @description Inngest background job for Pillar 3: Subscriber Cohort LTV & Weibull Hazard Decay
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';

export const evaluateSubscriberCohortJob = inngest.createFunction(
  {
    id: 'subscriber-cohort-job',
    name: 'Growth Triad v8 - Cohort LTV Decay Analysis',
    retries: 3,
  },
  { event: 'subscriber.cohort.evaluated' },
  async ({ event, step }) => {
    const { cohortMonth, cumulativeLtvUsd, hazardPeakMonth } = event.data;

    if (!cohortMonth) {
      throw new NonRetriableError('Missing cohortMonth');
    }

    // Step 1: Write LTV Snapshot to D1
    await step.run('persist-ltv-snapshot', async () => {
      const db = createServerClient();

      const insertQuery = `
        INSERT INTO subscriber_cohort_ltv_snapshots (snapshot_id, cohort_month, cumulative_ltv_usd, peak_hazard_month)
        VALUES (substr(lower(hex(randomblob(16))), 1, 32), ?, ?, ?)
      `;

      try {
        const stmt = db.prepare(insertQuery).bind(
          cohortMonth,
          cumulativeLtvUsd,
          hazardPeakMonth
        );
        await stmt.run();
      } catch (e: any) {
        throw new Error(`Failed to insert subscriber_cohort_ltv_snapshots: ${e.message}`);
      }
    });

    // Step 2: Trigger automated hazard interventions via other systems (mocked via logging out or DB update)
    if (hazardPeakMonth <= 3) {
      await step.run('trigger-early-hazard-intervention', async () => {
        // Here we might dispatch another Inngest event for email sequences
        return { action: 'Dispatched VIP Onboarding Email Sequence' };
      });
    } else {
      await step.run('trigger-standard-retention-nudge', async () => {
        return { action: 'Dispatched Standard Renewal Promo' };
      });
    }

    return {
      status: 'completed',
      cohortMonth,
      cumulativeLtvUsd,
      timestamp: new Date().toISOString()
    };
  }
);
