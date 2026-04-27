/**
 * Affiliate Short-Link Redirect Handler
 *
 * GET /api/r/[code] — validates short code, logs click, 302-redirects to merchant URL.
 * Public endpoint — no auth required.
 * Runs on Cloudflare Workers edge for <50ms p95.
 *
 * @module app/api/r/[code]/route
 */

import { NextRequest } from 'next/server';
import { isValidShortCode } from '@/lib/affiliate-shortlink/short-code-generator';
import { logClick } from '@/lib/affiliate-shortlink/click-logger';
import { createServerClient } from '@/lib/db/client';
import { checkRateLimit } from '@/lib/telegram/sql-rate-limiter';

interface AffiliateOfferRow {
  campaign_id: string;
  user_id: string;
  offer_id: string;
  affiliate_link: string;
}

const HOMEPAGE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code;

  // Validate short code format — prevent invalid DB queries
  if (!isValidShortCode(code)) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  // Extract click metadata from Cloudflare headers (used for both rate-limit key and click log)
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for');
  const country = request.headers.get('cf-ipcountry');
  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');

  // Rate limit per IP: 100 clicks/min — silently redirect on breach (don't expose 429 to share viewers)
  const rateLimit = await checkRateLimit(`r:${ip ?? 'unknown'}`, 100, 60);
  if (!rateLimit.allowed) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

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
