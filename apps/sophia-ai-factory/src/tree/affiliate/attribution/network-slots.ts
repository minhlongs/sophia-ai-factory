/**
 * Network-specific Attribution Slot Resolution
 *
 * Layer: tree/affiliate
 */

import type { ParsedSlots } from './types';

export function applyNetworkSpecificSlots(
  normalizedNetwork: string | undefined,
  payload: Record<string, unknown>,
  slots: ParsedSlots,
): void {
  if (normalizedNetwork === 'accesstrade') {
    slots.campaignId = slots.campaignId || (payload.sub1 as string) || null;
    slots.affiliateUserId = slots.affiliateUserId || (payload.sub2 as string) || null;
    slots.clickId = slots.clickId || (payload.sub3 as string) || (payload.click_id as string) || null;
  } else if (normalizedNetwork === 'awin') {
    slots.campaignId = slots.campaignId || (payload.click_ref as string) || null;
    slots.affiliateUserId = slots.affiliateUserId || (payload.click_ref2 as string) || null;
    slots.clickId = slots.clickId || (payload.click_ref3 as string) || null;
  } else if (normalizedNetwork === 'clickbank') {
    const cvend = (payload.cvendthru as string) || (payload.tid as string);
    if (cvend && !slots.rawSubId) slots.rawSubId = cvend;
    slots.affiliateUserId = slots.affiliateUserId || (payload.affiliate as string) || null;
  } else if (normalizedNetwork === 'amazon_associates' || normalizedNetwork === 'amazon') {
    if (payload.tag && !slots.affiliateUserId) slots.affiliateUserId = String(payload.tag);
    if (payload.ascsubtag && !slots.campaignId) slots.campaignId = String(payload.ascsubtag);
  }
}
