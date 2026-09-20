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

function extractRawSubIdFromPayload(payload: Record<string, unknown>): string | null {
  if (typeof payload.subId === 'string' && payload.subId.trim()) return payload.subId.trim();
  if (typeof payload.sub_id === 'string' && payload.sub_id.trim()) return payload.sub_id.trim();
  if (typeof payload.aff_sub === 'string' && payload.aff_sub.trim()) return payload.aff_sub.trim();
  if (typeof payload.cvendthru === 'string' && payload.cvendthru.trim()) return payload.cvendthru.trim();
  if (typeof payload.tid === 'string' && payload.tid.trim()) return payload.tid.trim();
  if (typeof payload.click_ref === 'string' && payload.click_ref.trim()) return payload.click_ref.trim();
  if (typeof payload.sub1 === 'string' && payload.sub1.trim()) return payload.sub1.trim();
  if (typeof payload.ascsubtag === 'string' && payload.ascsubtag.trim()) return payload.ascsubtag.trim();
  if (typeof payload.tag === 'string' && payload.tag.trim()) return payload.tag.trim();
  return null;
}

function deconstructSubIdString(subId: string): {
  campaignId: string | null;
  affiliateUserId: string | null;
  clickId: string | null;
} {
  // Pattern 1: Key-value delimiters e.g. cmp:123|aff:456|clk:789
  if (subId.includes('|') || (subId.includes(':') && !subId.startsWith('http'))) {
    const parts = subId.split(/[|&,]/);
    let c: string | null = null;
    let a: string | null = null;
    let k: string | null = null;
    for (const p of parts) {
      const [key, val] = p.split(/[:=]/);
      if (!val) continue;
      const cleanKey = key.trim().toLowerCase();
      if (cleanKey === 'cmp' || cleanKey === 'campaign') c = val.trim();
      if (cleanKey === 'aff' || cleanKey === 'user') a = val.trim();
      if (cleanKey === 'clk' || cleanKey === 'click') k = val.trim();
    }
    if (c || a || k) {
      return { campaignId: c, affiliateUserId: a, clickId: k };
    }
  }

  // Pattern 2: Delimited tokens e.g. camp_XXX_aff_YYY_clk_ZZZ
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

  return { campaignId: null, affiliateUserId: null, clickId: null };
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
      const q =
        input.queryParams instanceof URLSearchParams
          ? Object.fromEntries(input.queryParams.entries())
          : input.queryParams;
      rawSubId =
        q.sub_id ||
        q.subId ||
        q.aff_sub ||
        q.sub1 ||
        q.click_ref ||
        q.tid ||
        q.cvendthru ||
        q.tag ||
        q.ascsubtag ||
        null;
    }
  }

  // 1. Direct field extraction from payload
  let campaignId: string | null =
    (payload.campaignId as string) || (payload.campaign_id as string) || null;
  let affiliateUserId: string | null =
    (payload.affiliateId as string) ||
    (payload.affiliate_id as string) ||
    (payload.affiliate as string) ||
    null;
  let clickId: string | null =
    (payload.clickId as string) || (payload.click_id as string) || null;
  const orderId: string | null =
    (payload.conversionId as string) ||
    (payload.order_id as string) ||
    (payload.orderId as string) ||
    (payload.receipt as string) ||
    (payload.id ? String(payload.id) : null);

  // 2. Network-specific slot conventions
  const normalizedNetwork = network ? network.toLowerCase() : undefined;
  if (normalizedNetwork === 'accesstrade') {
    campaignId = campaignId || (payload.sub1 as string) || null;
    affiliateUserId = affiliateUserId || (payload.sub2 as string) || null;
    clickId = clickId || (payload.sub3 as string) || (payload.click_id as string) || null;
  } else if (normalizedNetwork === 'awin') {
    campaignId = campaignId || (payload.click_ref as string) || null;
    affiliateUserId = affiliateUserId || (payload.click_ref2 as string) || null;
    clickId = clickId || (payload.click_ref3 as string) || null;
  } else if (normalizedNetwork === 'clickbank') {
    const cvend = (payload.cvendthru as string) || (payload.tid as string);
    if (cvend && !rawSubId) rawSubId = cvend;
    affiliateUserId = affiliateUserId || (payload.affiliate as string) || null;
  } else if (normalizedNetwork === 'amazon_associates' || normalizedNetwork === 'amazon') {
    if (payload.tag && !affiliateUserId) affiliateUserId = String(payload.tag);
    if (payload.ascsubtag && !campaignId) campaignId = String(payload.ascsubtag);
  }

  // 3. Deconstruct rawSubId if tokenized
  if (rawSubId) {
    const deconstructed = deconstructSubIdString(rawSubId);
    if (deconstructed.campaignId && !campaignId) campaignId = deconstructed.campaignId;
    if (deconstructed.affiliateUserId && !affiliateUserId) affiliateUserId = deconstructed.affiliateUserId;
    if (deconstructed.clickId && !clickId) clickId = deconstructed.clickId;

    // Direct campaign identifier detection (e.g. camp_tiktok_viral_01 or campaign_...)
    if (!campaignId && (rawSubId.startsWith('camp_') || rawSubId.startsWith('campaign_'))) {
      campaignId = rawSubId;
    }
  }

  return {
    campaignId: campaignId ?? null,
    affiliateUserId: affiliateUserId ?? 'aff_default',
    clickId: clickId ?? null,
    rawSubId: rawSubId ?? null,
    network,
    orderId: orderId ?? null,
  };
}
