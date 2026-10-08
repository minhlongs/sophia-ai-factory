/**
 * @file sponsorship-pitch-job.ts
 * @description Inngest background job for persisting calculated sponsorship rate cards & pitch decks
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const sponsorshipPitchJob = inngest.createFunction(
  {
    id: 'growth-sponsorship-pitch-job',
    name: 'Growth: Sponsorship Pitch Job',
  },
  { event: 'sponsorship.ratecard.calculated' },
  async ({ event, step }) => {
    const { channelId, niche, effectiveCpmUsd, dedicatedUsd } = event.data;

    await step.run('audit-sponsorship-ratecard', async () => {
      logger.info('Auditing sponsorship ratecard persistence', {
        channelId,
        niche,
        effectiveCpmUsd,
        dedicatedUsd,
      });

      const db = createServerClient();
      const now = Date.now();
      const auditId = `aud_spons_${now}_${Math.random().toString(36).substring(2, 7)}`;

      await db
        .prepare(
          `INSERT INTO sponsorship_rate_cards (
             id, channel_id, channel_name, niche, expected_30d_views,
             engagement_rate, tier1_audience_pct, effective_cpm_usd,
             dedicated_usd, midroll_usd, preroll_usd,
             pitch_subject, pitch_body, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          auditId,
          channelId,
          'Channel Auto Audit',
          niche,
          100000,
          0.04,
          85.0,
          effectiveCpmUsd,
          dedicatedUsd,
          dedicatedUsd * 0.5,
          dedicatedUsd * 0.3,
          `Rate Card: ${channelId}`,
          `Audited sponsorship tier: $${dedicatedUsd}`,
          now,
          now
        )
        .run();

      return { auditId, persisted: true };
    });

    return { success: true, channelId, dedicatedUsd };
  }
);
