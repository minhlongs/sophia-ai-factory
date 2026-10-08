/**
 * @file sponsorship-actions.ts
 * @description Server Actions for Dynamic Sponsorship Rate Card Valuation & Pitch Decks
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  calculateSponsorshipValuation,
  generateBrandPitchEmail,
} from '@/tree/sponsorship/sponsorship-valuation-engine';
import type {
  SponsorshipValuationInput,
  BrandPitchEmail,
} from '@/seed/types/growth-triad-v7-types';

export async function calculateAndPersistSponsorshipAction(
  params: SponsorshipValuationInput,
  brandPartnerName = 'Acme Corp'
): Promise<
  | { success: true; cardId: string; pitchEmail: BrandPitchEmail }
  | { success: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }

  const rateCard = calculateSponsorshipValuation(params);
  const pitchEmail = generateBrandPitchEmail(
    params.channelName,
    params.niche,
    params.expected30dViews,
    rateCard,
    brandPartnerName
  );

  const db = createServerClient();
  const now = Date.now();
  const cardId = `ratecard_${now}_${Math.random().toString(36).substring(2, 7)}`;

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
      cardId,
      params.channelId,
      params.channelName,
      params.niche,
      params.expected30dViews,
      params.engagementRate,
      params.tier1AudiencePct,
      rateCard.effectiveCpmUsd,
      rateCard.dedicatedVideoUsd,
      rateCard.sixtySecMidRollUsd,
      rateCard.thirtySecPreRollUsd,
      pitchEmail.subject,
      pitchEmail.body,
      now,
      now
    )
    .run();

  await inngest.send({
    name: 'sponsorship.ratecard.calculated',
    data: {
      channelId: params.channelId,
      niche: params.niche,
      effectiveCpmUsd: rateCard.effectiveCpmUsd,
      dedicatedUsd: rateCard.dedicatedVideoUsd,
    },
  });

  return { success: true, cardId, pitchEmail };
}
