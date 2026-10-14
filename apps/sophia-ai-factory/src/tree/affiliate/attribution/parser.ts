/**
 * Core Affiliate Sub-ID Parser
 *
 * Layer: tree/affiliate
 */

import type {
  AffiliateNetwork,
  AffiliateAttribution,
  ParseSubIdInput,
  ParsedSlots,
} from './types';
import {
  extractRawSubIdFromPayload,
  extractSubIdFromQueryParams,
  extractOrderId,
} from './sub-id-extractors';
import { applyDeconstructedSubId } from './sub-id-deconstructors';
import { applyNetworkSpecificSlots } from './network-slots';

/**
 * Extracts campaign ID, affiliate user ID, and click ID across all supported networks.
 */
export function parseAffiliateSubId(
  input: string | ParseSubIdInput,
  networkFallback?: AffiliateNetwork,
): AffiliateAttribution {
  let rawSubId: string | null = null;
  let payload: Record<string, unknown> = {};
  let network: AffiliateNetwork | undefined = networkFallback;

  if (typeof input === 'string') {
    rawSubId = input.trim();
  } else if (input && typeof input === 'object') {
    network = input.network ?? networkFallback;
    payload = input.payload ?? {};
    rawSubId = input.rawSubId ?? extractRawSubIdFromPayload(payload);
    if (!rawSubId && input.queryParams) {
      rawSubId = extractSubIdFromQueryParams(input.queryParams);
    }
  }

  const slots: ParsedSlots = {
    campaignId: (payload.campaignId as string) || (payload.campaign_id as string) || null,
    affiliateUserId:
      (payload.affiliateId as string) ||
      (payload.affiliate_id as string) ||
      (payload.affiliate as string) ||
      null,
    clickId: (payload.clickId as string) || (payload.click_id as string) || null,
    rawSubId,
  };

  const normalizedNetwork = network ? network.toLowerCase() : undefined;
  applyNetworkSpecificSlots(normalizedNetwork, payload, slots);

  if (slots.rawSubId) {
    applyDeconstructedSubId(slots.rawSubId, slots);
  }

  return {
    campaignId: slots.campaignId ?? null,
    affiliateUserId: slots.affiliateUserId ?? 'aff_default',
    clickId: slots.clickId ?? null,
    rawSubId: slots.rawSubId ?? null,
    network,
    orderId: extractOrderId(payload),
  };
}
