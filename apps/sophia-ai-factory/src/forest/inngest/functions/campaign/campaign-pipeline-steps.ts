/**
 * Helper steps for Campaign Inngest Function (idempotency, affiliate offer, AB title, tier validation).
 *
 * Layer: forest/inngest/functions/campaign
 *
 * @module forest/inngest/functions/campaign/campaign-pipeline-steps
 */

import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { TIER_RANK, type Tier } from '@/seed/types';
import { getExperiment } from '@/forest/ab/experiment-store';
import type { AffiliateOfferSelectedRow } from './types';

export async function checkCampaignIdempotency(
  campaignId: string,
): Promise<{ shouldSkip: boolean; status?: string }> {
  const idempotencyDb = createServerClient();
  const { data: existingCampaign } = (await idempotencyDb
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .single()) as { data: { id: string; status: string } | null };

  if (
    existingCampaign &&
    ['processing_script', 'processing_video', 'completed'].includes(existingCampaign.status)
  ) {
    logger.info('[generateCampaign] Campaign already processed — skipping', {
      campaignId,
      status: existingCampaign.status,
    });
    return { shouldSkip: true, status: existingCampaign.status };
  }

  return { shouldSkip: false };
}

export async function loadCampaignAffiliateOffer(
  campaignId: string,
): Promise<{
  productName: string;
  shortUrl: string;
  category?: string | null;
  network?: string | null;
} | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('affiliate_offers_selected')
      .select('short_code, offer_name, affiliate_link, network')
      .eq('campaign_id', campaignId)
      .single();
    const row = data as AffiliateOfferSelectedRow | null;
    if (!row) return null;
    const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'}/r/${row.short_code}`;
    return {
      productName: row.offer_name,
      shortUrl,
      ...(row.category !== undefined ? { category: row.category } : {}),
      ...(row.network !== undefined ? { network: row.network } : {}),
    };
  } catch (error) {
    logger.warn('[generate-campaign] failed to load affiliate offer for campaign', {
      campaignId,
      error: String(error),
    });
    return null;
  }
}

export async function resolveCampaignAbTitle(
  abExperimentId: string | undefined,
  topic: string | undefined,
  campaignId: string,
): Promise<string> {
  if (!abExperimentId) return topic || `Campaign ${campaignId}`;
  try {
    const experiment = await getExperiment(abExperimentId);
    if (experiment?.variantACaption) return experiment.variantACaption;
  } catch (err) {
    logger.warn('[generateCampaign] AB experiment lookup failed — using original title', {
      campaignId,
      abExperimentId,
      error: String(err),
    });
  }
  return topic || `Campaign ${campaignId}`;
}

export async function enforceMidFlightTier(
  campaignId: string,
  userId: string,
  eventTier: Tier,
  currentTier: Tier,
  onDowngradeAbort: (errorMessage: string) => Promise<unknown>,
): Promise<void> {
  const eventTierRank = TIER_RANK[eventTier] ?? 0;
  const currentTierRank = TIER_RANK[currentTier] ?? 0;
  if (currentTierRank < eventTierRank) {
    logger.warn('[generateCampaign] Tier downgrade mid-flight — aborting distribution', {
      campaignId,
      userId,
      eventTier,
      currentTier,
    });
    await onDowngradeAbort(
      `Tier downgraded mid-flight from ${eventTier} to ${currentTier}. Campaign aborted.`,
    ).catch((err) => {
      logger.warn('Failed to update campaign status after tier downgrade', {
        error: String(err),
        context: 'generateCampaign',
        campaignId,
      });
    });
    throw new NonRetriableError(
      `Tier downgrade mid-flight: ${eventTier} → ${currentTier}. Please re-run with an active tier.`,
    );
  }
}
