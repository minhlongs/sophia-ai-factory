/**
 * Sub-ID String Deconstructors and Token Parsers
 *
 * Layer: tree/affiliate
 */

import type { ParsedSlots } from './types';

export function parseKeyValueSubId(subId: string): {
  campaignId: string | null;
  affiliateUserId: string | null;
  clickId: string | null;
} | null {
  if (!subId.includes('|') && (!subId.includes(':') || subId.startsWith('http'))) {
    return null;
  }

  const parts = subId.split(/[|&,]/);
  let campaignId: string | null = null;
  let affiliateUserId: string | null = null;
  let clickId: string | null = null;

  for (const p of parts) {
    const [key, val] = p.split(/[:=]/);
    if (!val) continue;
    const cleanKey = key.trim().toLowerCase();
    if (cleanKey === 'cmp' || cleanKey === 'campaign') campaignId = val.trim();
    if (cleanKey === 'aff' || cleanKey === 'user') affiliateUserId = val.trim();
    if (cleanKey === 'clk' || cleanKey === 'click') clickId = val.trim();
  }

  if (campaignId || affiliateUserId || clickId) {
    return { campaignId, affiliateUserId, clickId };
  }
  return null;
}

export function parseTokenizedSubId(subId: string): {
  campaignId: string | null;
  affiliateUserId: string | null;
  clickId: string | null;
} | null {
  const campMatch = subId.match(/(?:camp|campaign)[_-]([a-zA-Z0-9_-]+?)(?:[_-]aff|[_-]usr|[_-]clk|$)/i);
  const affMatch = subId.match(/(?:aff|usr|user)[_-]([a-zA-Z0-9_-]+?)(?:[_-]clk|$)/i);
  const clkMatch = subId.match(/(?:clk|click)[_-]([a-zA-Z0-9_-]+?)$/i);

  if (campMatch || affMatch || clkMatch) {
    return {
      campaignId: campMatch ? `camp_${campMatch[1]}` : null,
      affiliateUserId: affMatch ? `aff_${affMatch[1]}` : null,
      clickId: clkMatch ? clkMatch[1] : null,
    };
  }
  return null;
}

export function deconstructSubIdString(subId: string): {
  campaignId: string | null;
  affiliateUserId: string | null;
  clickId: string | null;
} {
  return (
    parseKeyValueSubId(subId) ??
    parseTokenizedSubId(subId) ?? {
      campaignId: null,
      affiliateUserId: null,
      clickId: null,
    }
  );
}

export function applyDeconstructedSubId(rawSubId: string, slots: ParsedSlots): void {
  const deconstructed = deconstructSubIdString(rawSubId);
  if (deconstructed.campaignId && !slots.campaignId) slots.campaignId = deconstructed.campaignId;
  if (deconstructed.affiliateUserId && !slots.affiliateUserId) slots.affiliateUserId = deconstructed.affiliateUserId;
  if (deconstructed.clickId && !slots.clickId) slots.clickId = deconstructed.clickId;

  if (!slots.campaignId && (rawSubId.startsWith('camp_') || rawSubId.startsWith('campaign_'))) {
    slots.campaignId = rawSubId;
  }
}
