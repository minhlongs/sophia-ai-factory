/**
 * Affiliate Actions Submodule: Discovery & Adoption Actions.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/discovery-actions
 */

'use server';

import { getAffiliateOffers } from '@/tree/affiliates/affiliate-ledger-service';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { persistAdoptedCampaignRun } from './discovery-helpers';
import type {
  AdoptAffiliateOfferInput,
  AdoptAffiliateOfferResult,
  GetAffiliateOffersInput,
  GetAffiliateOffersResult,
} from './types';

/**
 * Fetch affiliate offers with optional filtering and sorting.
 */
export async function getAffiliateOffersAction(
  filters: GetAffiliateOffersInput = {}
): Promise<GetAffiliateOffersResult> {
  try {
    const result = await getAffiliateOffers({
      category: filters.category,
      payoutModel: filters.payoutModel,
      search: filters.search,
      sortBy: filters.sortBy,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    });

    return {
      success: true,
      offers: result.offers,
      total: result.total,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-actions] Error fetching affiliate offers', {
      error: error.message,
    });
    return {
      success: false,
      offers: [],
      total: 0,
      error: error.message || 'Failed to fetch affiliate offers',
    };
  }
}

/**
 * 1-Click Campaign Adoption into Creator Studio or Distribution Queue.
 */
export async function adoptAffiliateOfferAction(
  input: AdoptAffiliateOfferInput
): Promise<AdoptAffiliateOfferResult> {
  try {
    if (!input.offerId || typeof input.offerId !== 'string') {
      return {
        success: false,
        error: 'Valid offerId is required',
      };
    }

    if (input.target !== 'creator_studio' && input.target !== 'distribution_queue') {
      return {
        success: false,
        error: 'Invalid adoption target. Must be creator_studio or distribution_queue',
      };
    }

    const { offers } = await getAffiliateOffers({ limit: 100 });
    const offer = offers.find(
      (o) => o.id.toLowerCase() === input.offerId.toLowerCase()
    );

    const programTitle = offer ? offer.programName : input.campaignName || 'Partner Campaign';
    const campaignId = `camp_${crypto.randomUUID().slice(0, 8)}`;
    const now = Date.now();

    await persistAdoptedCampaignRun({
      campaignId,
      programTitle,
      input,
      offer,
      now,
    });

    const deepLink =
      input.target === 'creator_studio'
        ? `/creator/studio?offerId=${encodeURIComponent(input.offerId)}&campaignId=${campaignId}`
        : `/creator/studio?tab=queue&campaignId=${campaignId}`;

    const message =
      input.target === 'creator_studio'
        ? `Offer "${programTitle}" adopted into Creator Studio.`
        : `Offer "${programTitle}" queued for distribution.`;

    logger.info('[affiliate-actions] Affiliate offer adopted', {
      offerId: input.offerId,
      target: input.target,
      campaignId,
      deepLink,
    });

    return {
      success: true,
      campaignId,
      target: input.target,
      deepLink,
      message,
    };
  } catch (err) {
    const error = toError(err);
    logger.error('[affiliate-actions] Error adopting affiliate offer', {
      error: error.message,
    });
    return {
      success: false,
      error: error.message || 'Failed to adopt affiliate offer',
    };
  }
}
