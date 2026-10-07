/**
 * GET /api/affiliates/offers
 *
 * Returns active affiliate programs supporting category, payout model, and text filters.
 * Backed by D1 affiliate_offers with fallback to verified authentic catalog.
 * Cached in Cloudflare KV_KV with 60-second TTL.
 *
 * @module app/api/affiliates/offers
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateOffers } from '@/tree/affiliates/affiliate-ledger-service';
import { logger } from '@/seed/utils/logger-utility';

function getKv(): KVNamespace | null {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>;
    if (g.KV_KV && typeof (g.KV_KV as KVNamespace).get === 'function') {
      return g.KV_KV as KVNamespace;
    }
    const env = (g as Record<string, Record<string, unknown>>).__env__;
    if (env?.KV_KV && typeof (env.KV_KV as KVNamespace).get === 'function') {
      return env.KV_KV as KVNamespace;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const payoutModel = searchParams.get('payoutModel') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const sortBy = (searchParams.get('sortBy') as 'epc' | 'conversion' | 'commission' | 'quality') ?? undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const kv = getKv();
    const cacheKey = `affiliate:offers:${category || 'all'}:${payoutModel || 'all'}:${search || ''}:${sortBy || 'epc'}:${limit}:${offset}`;

    if (kv) {
      try {
        const cached = await kv.get(cacheKey, 'json');
        if (cached) {
          return NextResponse.json({
            success: true,
            cached: true,
            ...(cached as Record<string, unknown>),
          });
        }
      } catch (kvErr) {
        logger.warn('[AffiliateOffersRoute] KV read failed', { error: String(kvErr) });
      }
    }

    const result = await getAffiliateOffers({
      category,
      payoutModel,
      search,
      sortBy,
      limit,
      offset,
    });

    if (kv) {
      await kv
        .put(cacheKey, JSON.stringify(result), { expirationTtl: 60 })
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      offers: result.offers,
      total: result.total,
    });
  } catch (err) {
    logger.error('[AffiliateOffersRoute] Error querying offers', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
