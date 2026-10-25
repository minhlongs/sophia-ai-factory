/**
 * Affiliate Short-Link Redirect Helpers
 * @module app/api/r/[code]/redirect-helpers
 */

import { recordClick } from '@/land/affiliates/click-recorder';

export interface AffiliateOfferRow {
  campaign_id: string;
  user_id: string;
  offer_id: string;
  affiliate_link: string;
  network?: string | null;
}

export interface AffiliateLinkRow {
  id: string;
  tenant_id: string;
  offer_id: string;
  user_id: string;
  code: string;
  sub_id: string | null;
}

export interface AffiliateOfferEngineRow {
  id: string;
  product_url: string;
  network_id: string;
}

export const HOMEPAGE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

export function getSubIdParam(networkId: string): string {
  switch (networkId) {
    case 'tiktok-shop':
    case 'tiktok_shop':
      return 'aff_sub';
    case 'accesstrade':
      return 'utm_content';
    case 'clickbank':
      return 'tid';
    case 'awin':
      return 'clickref';
    case 'amazon':
    case 'amazon_associates':
      return 'tag';
    default:
      return 'sub_id';
  }
}

export async function tryResolveOfferEngineRedirect(params: {
  d1: D1Database;
  code: string;
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  referer: string | null;
}): Promise<Response | null> {
  const { d1, code, ip, country, userAgent, referer } = params;
  const linkRow = await d1
    .prepare(
      'SELECT id, tenant_id, offer_id, user_id, code, sub_id FROM affiliate_links WHERE code = ? LIMIT 1',
    )
    .bind(code)
    .first<AffiliateLinkRow>();

  if (!linkRow) return null;

  const offerRow = await d1
    .prepare('SELECT id, product_url, network_id FROM affiliate_offers WHERE id = ? LIMIT 1')
    .bind(linkRow.offer_id)
    .first<AffiliateOfferEngineRow>();

  if (!offerRow) return null;

  const clickId = crypto.randomUUID();
  const tenantSlug = linkRow.tenant_id.slice(0, 16);
  let subIdValue = linkRow.sub_id;

  if (!subIdValue) {
    subIdValue = `${tenantSlug}-${linkRow.id.replace(/-/g, '').slice(0, 12)}`;
    d1.prepare('UPDATE affiliate_links SET sub_id = ? WHERE id = ? AND sub_id IS NULL')
      .bind(subIdValue, linkRow.id)
      .run()
      .catch(() => {
        /* best-effort — redirect proceeds regardless */
      });
  }

  const paramName = getSubIdParam(offerRow.network_id);

  let destinationUrl: URL;
  try {
    destinationUrl = new URL(offerRow.product_url);
  } catch {
    return Response.redirect(HOMEPAGE_URL, 302);
  }
  if (destinationUrl.protocol !== 'https:' && destinationUrl.protocol !== 'http:') {
    return Response.redirect(HOMEPAGE_URL, 302);
  }
  destinationUrl.searchParams.set(paramName, subIdValue);

  recordClick({
    clickId,
    tenantId: linkRow.tenant_id,
    linkId: linkRow.id,
    offerId: linkRow.offer_id,
    ip,
    userAgent,
    referrer: referer,
    country,
  });

  return Response.redirect(destinationUrl.toString(), 302);
}
