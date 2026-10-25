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
import { isValidShortCode } from '@/land/affiliate-shortlink/short-code-generator';
import { logClick } from '@/land/affiliate-shortlink/click-logger';
import { createServerClient } from '@/seed/db/client';
import { checkRateLimit } from '@/tree/telegram/sql-rate-limiter';
import {
  HOMEPAGE_URL,
  getSubIdParam,
  tryResolveOfferEngineRedirect,
  type AffiliateOfferRow,
} from './redirect-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code;

  if (!isValidShortCode(code)) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for');
  const country = request.headers.get('cf-ipcountry');
  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');

  const rateLimit = await checkRateLimit(`r:${ip ?? 'unknown'}`, 100, 60);
  if (!rateLimit.allowed) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  const rawDb = (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
  const d1 = rawDb?.DB as D1Database | undefined;

  if (d1) {
    const engineRedirect = await tryResolveOfferEngineRedirect({
      d1,
      code,
      ip,
      country,
      userAgent,
      referer,
    });
    if (engineRedirect) {
      return engineRedirect;
    }
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('affiliate_offers_selected')
    .select('campaign_id, user_id, offer_id, affiliate_link, network')
    .eq('short_code', code)
    .single();

  const offer = data as AffiliateOfferRow | null;

  if (error || !offer) {
    return Response.redirect(HOMEPAGE_URL, 302);
  }

  const clickId = crypto.randomUUID();
  const tid = clickId.replace(/-/g, '').slice(0, 24);
  const subParam = getSubIdParam(offer.network || 'clickbank');

  const affiliateUrl = new URL(offer.affiliate_link);
  affiliateUrl.searchParams.set(subParam, tid);

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
