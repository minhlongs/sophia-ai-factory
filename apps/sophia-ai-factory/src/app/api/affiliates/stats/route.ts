/**
 * GET /api/affiliates/stats
 *
 * Returns aggregated platform-wide and partner-specific affiliate stats.
 * Uses Cloudflare KV_KV with 60-second TTL for edge performance.
 *
 * @module app/api/affiliates/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  getAffiliateLedgerStats,
  getPartnerLedgerStats,
  getPartnerSummary,
} from '@/tree/affiliates/affiliate-ledger-service';
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
    const kv = getKv();
    const user = await getCurrentUser().catch(() => null);

    // 1. Check Platform Stats KV Cache
    const cacheKey = 'affiliate:stats:platform';
    let platformStats = null;

    if (kv) {
      try {
        const cached = await kv.get(cacheKey, 'json');
        if (cached) {
          platformStats = cached;
        }
      } catch (kvErr) {
        logger.warn('[AffiliatesStatsRoute] KV read error', { error: String(kvErr) });
      }
    }

    if (!platformStats) {
      platformStats = await getAffiliateLedgerStats();
      if (kv) {
        await kv
          .put(cacheKey, JSON.stringify(platformStats), { expirationTtl: 60 })
          .catch(() => {});
      }
    }

    // 2. If authenticated user is a partner, resolve their personal stats
    let partnerStats = null;
    if (user?.id) {
      const partnerCacheKey = `affiliate:stats:partner:${user.id}`;
      if (kv) {
        try {
          partnerStats = await kv.get(partnerCacheKey, 'json');
        } catch {
          // ignore
        }
      }

      if (!partnerStats) {
        const partner = await getPartnerSummary(user.id);
        if (partner) {
          partnerStats = await getPartnerLedgerStats(partner.id);
          if (kv && partnerStats) {
            await kv
              .put(partnerCacheKey, JSON.stringify(partnerStats), { expirationTtl: 60 })
              .catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      stats: platformStats,
      partnerStats,
    });
  } catch (err) {
    logger.error('[AffiliatesStatsRoute] Failed to fetch stats', { error: String(err) });
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
