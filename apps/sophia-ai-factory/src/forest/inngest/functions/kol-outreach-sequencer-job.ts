/**
 * @file kol-outreach-sequencer-job.ts
 * @description Inngest background job for durable creator email sequence progression
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { advanceKolStatusFsm } from '@/tree/creator/recruitment-fsm-engine';
import { logger } from '@/seed/utils/logger-utility';
import type { KolStatus } from '@/seed/types/growth-triad-v5-types';

export const kolOutreachSequencerJob = inngest.createFunction(
  {
    id: 'growth-kol-outreach-sequencer-job',
    name: 'Growth: KOL Outreach Sequencer Job',
  },
  { event: 'kol.outreach.enrolled' },
  async ({ event, step }) => {
    const { kolId, handle, platform, offeredSplitPct } = event.data;

    // Step 1: Send introduction pitch
    await step.run('dispatch-intro-pitch', async () => {
      logger.info('Dispatching intro pitch email to creator', { kolId, handle, platform });
      const db = createServerClient();
      const now = Date.now();
      const updatedStatus = advanceKolStatusFsm('SCOUTED', 'SEND_INTRO');

      await db
        .prepare(
          `UPDATE kol_lead_records
           SET status = ?, current_split_pct = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(updatedStatus, offeredSplitPct, now, kolId)
        .run();

      return { introSent: true, status: updatedStatus };
    });

    // Step 2: Durable wait 3 days before case study follow-up
    await step.sleep('wait-for-case-study', '3d');

    // Step 3: Check opt-out state before sending case study
    const continueSequence = await step.run('verify-creator-status', async () => {
      const db = createServerClient();
      const record = await db
        .prepare('SELECT status, unsubscribed FROM kol_lead_records WHERE id = ?')
        .bind(kolId)
        .first<{ status: KolStatus; unsubscribed: number }>();

      if (!record || record.unsubscribed === 1) {
        return false;
      }
      return true;
    });

    if (!continueSequence) {
      return { aborted: true, reason: 'Creator unsubscribed or record missing' };
    }

    // Step 4: Dispatch case study proof
    await step.run('dispatch-case-study', async () => {
      logger.info('Dispatching agency case study to creator', { kolId });
      const db = createServerClient();
      const now = Date.now();
      const updatedStatus = advanceKolStatusFsm('OUTREACH_INTRO_SENT', 'SEND_CASE_STUDY');

      await db
        .prepare(
          `UPDATE kol_lead_records
           SET status = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(updatedStatus, now, kolId)
        .run();

      return { caseStudySent: true, status: updatedStatus };
    });

    return { success: true, kolId };
  }
);
