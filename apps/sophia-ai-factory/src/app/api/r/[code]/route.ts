/**
 * Affiliate Short-Link Redirect Handler
 *
 * GET /api/r/[code] — validates short code, logs click, 302-redirects to merchant URL.
 * Public endpoint — no auth required.
 * Runs on Cloudflare Workers edge for <50ms p95.
 *
 * Extended (Phase 09): Lookup from affiliate_links table, record click_events
 * with tenant_id + sub_id injection into provider URL.
 *
 * @module app/api/r/[code]/route
 */

import { NextRequest } from 'next/server';
import { isValidShortCode } from '@/lib/affiliate-shortlink/short-code-generator';
import { logClick } from '@/lib/affiliate-shortlink/click-logger';
import { createServerClient } from '@/lib/db/client';
import { checkRateLimit } from '@/lib/telegram/sql-rate-limiter';
import { recordClick } from '@/lib/affiliates/click-recorder';

interface AffiliateOfferRow {
  campaign_id: string;
  user_id: string;
  offer_id: string;
  affiliate_link: string;
}

/** affiliate_links row for Phase 09 offer engine */
interface AffiliateLinkRow {
  id: string;
  tenant_id: string;
  offer_id: string;
  user_id: string;
  code: string;
  sub_id: string | null;
}

/** affiliate_offers row for Phase 09 */
interface AffiliateOfferEngineRow {
  id: string;
  product_url: string;
  network_id: string;
}

const HOMEPAGE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

/** Provider-specific sub_id param name */
function getSubIdParam(networkId: string): string {
  switch (networkId) {
    case 'tiktok-shop': return 'aff_sub';
    case 'accesstrade': return 'utm_content';
    case 'clickbank': return 'tid';
    case 'awin': return 'clickref';
    case 'amazon': return 'tag';
    default: return 'sub_id';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code;

  // Validate short code format — prevent invalid DB queries
  if (!isValidShortCode(code)) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  // Extract click metadata from Cloudflare headers
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for');
  const country = request.headers.get('cf-ipcountry');
  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');

  // Rate limit per IP: 100 clicks/min
  const rateLimit = await checkRateLimit(`r:${ip ?? 'unknown'}`, 100, 60);
  if (!rateLimit.allowed) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  // Phase 09: try affiliate_links table first (new offer engine)
  const rawDb = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  const d1 = rawDb?.DB as D1Database | undefined;

  if (d1) {
    const linkRow = await d1
      .prepare('SELECT id, tenant_id, offer_id, user_id, code, sub_id FROM affiliate_links WHERE code = ? LIMIT 1')
      .bind(code)
      .first<AffiliateLinkRow>();

    if (linkRow) {
      const offerRow = await d1
        .prepare('SELECT id, product_url, network_id FROM affiliate_offers WHERE id = ? LIMIT 1')
        .bind(linkRow.offer_id)
        .first<AffiliateOfferEngineRow>();

      if (offerRow) {
        const clickId = crypto.randomUUID();
        // sub_id pattern: {tenantSlug}-{linkId} (injected into provider URL)
        const tenantSlug = linkRow.tenant_id.slice(0, 16);
        let subIdValue = linkRow.sub_id;

        // Persist generated sub_id at first redirect so webhook attribution resolves correctly
        if (!subIdValue) {
          subIdValue = `${tenantSlug}-${linkRow.id.replace(/-/g, '').slice(0, 12)}`;
          // Fire-and-forget UPDATE — do not block the redirect on DB write
          d1.prepare('UPDATE affiliate_links SET sub_id = ? WHERE id = ? AND sub_id IS NULL')
            .bind(subIdValue, linkRow.id)
            .run()
            .catch(() => { /* best-effort — redirect proceeds regardless */ });
        }

        const paramName = getSubIdParam(offerRow.network_id);

        // SSRF guard: only allow http/https schemes in product_url
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

        // Dual-write click event (fire-and-forget — does not block redirect)
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
    }
  }

  // Fallback: legacy affiliate_offers_selected table (pre-Phase-09 campaigns)
  const db = createServerClient();
  const { data, error } = await db
    .from('affiliate_offers_selected')
    .select('campaign_id, user_id, offer_id, affiliate_link')
    .eq('short_code', code)
    .single();

  const offer = data as AffiliateOfferRow | null;

  if (error || !offer) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  // Generate unique click ID for ClickBank attribution
  const clickId = crypto.randomUUID();
  // ClickBank tid accepts max 24 chars
  const tid = clickId.replace(/-/g, '').slice(0, 24);

  // Append tid to affiliate link for attribution
  const affiliateUrl = new URL(offer.affiliate_link);
  affiliateUrl.searchParams.set('tid', tid);

  // Fire-and-forget click logging — does not block redirect
  logClick({
    clickId,
    campaignId: offer.campaign_id,
    userId: offer.user_id,
    offerId: offer.offer_id,
    shortCode: code,
    ip,
    userAgent,
    referer,
    country,
  });

  return Response.redirect(affiliateUrl.toString(), 302);
}
