/**
 * Campaign Creation Domain Service
 *
 * Encapsulates database operations for campaigns:
 * - Monthly quota verification
 * - Campaign persistence
 * - Affiliate offer association with retry resilience
 *
 * @module land/campaigns/campaign-creation-service
 */

import { createServerClient } from '@/seed/db/client';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { getProgramById } from '@/land/affiliates';
import { generateShortCode } from '@/land/affiliate-shortlink/short-code-generator';
import { logger } from '@/seed/utils/logger-utility';
import type { Tier } from '@/seed/types';

export interface CampaignRecordInput {
  campaignId: string;
  userId: string;
  title: string;
  topic?: string;
  audience?: string;
  templateId?: string | null;
}

export interface MonthlyLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  monthLimit: number;
}

/**
 * Check if the user has reached their monthly campaign creation limit.
 */
export async function checkMonthlyCampaignLimit(
  userId: string,
  tier: Tier,
): Promise<MonthlyLimitCheckResult> {
  const db = createServerClient();
  const monthLimit = UNIFIED_TIERS[tier].campaignsPerMonth;

  if (monthLimit >= 999) {
    return { allowed: true, currentCount: 0, monthLimit };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: countData } = await db
    .from('campaigns')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', startOfMonth.toISOString());

  const currentCount = (countData as { id: string }[] | null)?.length ?? 0;
  return {
    allowed: currentCount < monthLimit,
    currentCount,
    monthLimit,
  };
}

/**
 * Insert a campaign record into D1 campaigns table.
 */
export async function insertCampaignRecord(
  input: CampaignRecordInput,
): Promise<{ success: boolean; error?: string }> {
  const db = createServerClient();
  const { error } = await db.from('campaigns').insert({
    id: input.campaignId,
    user_id: input.userId,
    title: input.title,
    topic: input.topic || '',
    audience: input.audience || '',
    status: 'queued',
    progress: 0,
    template_id: input.templateId,
  });

  if (error) {
    return {
      success: false,
      error: `Failed to create campaign: ${error.message || JSON.stringify(error)}`,
    };
  }

  return { success: true };
}

/**
 * Link selected affiliate offer to the campaign with retry resilience.
 */
export async function linkAffiliateOffer(
  campaignId: string,
  userId: string,
  offerId: string,
): Promise<boolean> {
  const program = getProgramById(offerId);
  if (!program) return false;

  const db = createServerClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const shortCode = generateShortCode();
    const { error: offerError } = await db.from('affiliate_offers_selected').insert({
      campaign_id: campaignId,
      user_id: userId,
      offer_id: program.id,
      offer_name: program.name,
      affiliate_link: program.link,
      short_code: shortCode,
      network: 'clickbank',
      commission_rate: parseFloat(program.commission) / 100,
    });
    if (!offerError) return true;
    if (attempt === 2) {
      logger.warn('affiliate_offer_insert_failed', { campaignId, offerId });
    }
  }

  return false;
}
