/**
 * Affiliate Sub-ID & Attribution Types
 *
 * Layer: tree/affiliate
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

export const SUB_ID_KEYS = [
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

export interface ParsedSlots {
  campaignId: string | null;
  affiliateUserId: string | null;
  clickId: string | null;
  rawSubId: string | null;
}
