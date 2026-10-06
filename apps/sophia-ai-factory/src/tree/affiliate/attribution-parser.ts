/**
 * Multi-Network Sub-ID & Click Attribution Parser
 * Pure Domain Layer (Tree)
 *
 * @module tree/affiliate/attribution-parser
 */

export type AffiliateNetwork =
  | 'tiktok_shop'
  | 'amazon_associates'
  | 'amazon'
  | 'clickbank'
  | 'accesstrade'
  | 'awin'
  | (string & {});

export interface AffiliateAttribution {
  campaignId: string | null;
  affiliateUserId: string;
  clickId: string | null;
  rawSubId: string | null;
  network?: AffiliateNetwork;
  orderId?: string | null;
}

export interface ParseSubIdInput {
  network?: AffiliateNetwork;
  rawSubId?: string | null;
  payload?: Record<string, unknown>;
  queryParams?: Record<string, string> | URLSearchParams;
}

const SUB_ID_KEYS = [
  'sub_id',
  'subId',
  'aff_sub',
  'sub1',
  'click_ref',
  'tid',
  'cvendthru',
  'tag',
  'ascsubtag',
] as const;

function extractRawSubIdFromPayload(payload: Record<string, unknown>): string | null {
  for (const key of SUB_ID_KEYS) {
    const val = payload[key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

function extractSubIdFromQueryParams(
  queryParams: Record<string, string> | URLSearchParams,
): string | null {
  const q =
    queryParams instanceof URLSearchParams
      ? Object.fromEntries(queryParams.entries())
      : queryParams;
  for (const key of SUB_ID_KEYS) {
    if (q[key]) return q[key];
  }
  return null;
}

function parseKeyValueSubId(subId: string): {
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

function parseTokenizedSubId(subId: string): {
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

function deconstructSubIdString(subId: string): {
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

function extractOrderId(payload: Record<string, unknown>): string | null {
  return (
    (payload.conversionId as string) ||
    (payload.order_id as string) ||
    (payload.orderId as string) ||
    (payload.receipt as string) ||
    (payload.id ? String(payload.id) : null)
  );
}

interface ParsedSlots {
  campaignId: string | null;
  affiliateUserId: string | null;
  clickId: string | null;
  rawSubId: string | null;
}

function applyNetworkSpecificSlots(
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

function applyDeconstructedSubId(rawSubId: string, slots: ParsedSlots): void {
  const deconstructed = deconstructSubIdString(rawSubId);
  if (deconstructed.campaignId && !slots.campaignId) slots.campaignId = deconstructed.campaignId;
  if (deconstructed.affiliateUserId && !slots.affiliateUserId) slots.affiliateUserId = deconstructed.affiliateUserId;
  if (deconstructed.clickId && !slots.clickId) slots.clickId = deconstructed.clickId;

  if (!slots.campaignId && (rawSubId.startsWith('camp_') || rawSubId.startsWith('campaign_'))) {
    slots.campaignId = rawSubId;
  }
}

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

