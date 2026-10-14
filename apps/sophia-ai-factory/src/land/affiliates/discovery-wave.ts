/**
 * Agentic Affiliate Discovery Wave
 *
 * Concurrently scans, scores, and ranks high-EPC affiliate products across
 * supported networks: ClickBank, Awin, and ShareASale.
 * Applies composite quality scoring, EPC heuristics, and fail-closed scam gating.
 *
 * Layer: land (business workflow)
 * @module affiliates/discovery-wave
 */

import type { AffiliateOffer } from './provider-interface';
import { scoreAffiliate } from './scout/scoring';
import type { Network } from './scout/types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  PROVIDER_MAP,
  NETWORK_CTX,
  toAffiliate,
  type RankedDiscoveredOffer,
  type DiscoveryWaveQuery,
  type DiscoveryWaveResult,
} from './discovery-wave-helpers';

export type { RankedDiscoveredOffer, DiscoveryWaveQuery, DiscoveryWaveResult };

export async function runAgenticDiscoveryWave(
  query: DiscoveryWaveQuery = {},
): Promise<Result<DiscoveryWaveResult, Error>> {
  const {
    niche = 'saas',
    minScore = 0.5,
    limit = 20,
    networks = ['clickbank', 'awin', 'shareasale'],
    tenantId = 'sophia-global',
  } = query;

  const now = new Date().toISOString();
  const targetKeys = networks.filter((k) => k in PROVIDER_MAP);
  if (targetKeys.length === 0) {
    return failure(new Error('No valid affiliate networks selected for discovery wave'));
  }

  try {
    const providers = targetKeys.map((k) => ({ key: k, provider: PROVIDER_MAP[k]() }));
    const settled = await Promise.allSettled(
      providers.map(async ({ key, provider }) => {
        const offers = await provider.listOffers({ niche, limit: 50 });
        return { key, offers };
      }),
    );

    const rawOffers: { networkKey: Network; offer: AffiliateOffer }[] = [];
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        for (const o of res.value.offers) {
          rawOffers.push({ networkKey: res.value.key as Network, offer: o });
        }
      } else {
        logger.warn('[discovery-wave] network fetch failed', { error: String(res.reason) });
      }
    }

    const scoredOffers: RankedDiscoveredOffer[] = [];
    const breakdown: Record<string, number> = {};

    for (const { networkKey, offer } of rawOffers) {
      breakdown[networkKey] = (breakdown[networkKey] ?? 0) + 1;
      const aff = toAffiliate(offer, networkKey, tenantId, now);
      const ctx = NETWORK_CTX[networkKey] ?? { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.7 };
      const scored = scoreAffiliate(aff, {
        threshold: minScore,
        cookieDays: ctx.cookieDays,
        payoutFrequency: ctx.payoutFrequency,
        approvalRate: ctx.approvalRate,
      });

      if (scored.passes && scored.score >= minScore) {
        scoredOffers.push({
          externalId: offer.externalId,
          network: networkKey,
          title: offer.title,
          description: offer.description,
          productUrl: offer.productUrl,
          imageUrl: offer.imageUrl,
          commissionPct: offer.commissionPct,
          commissionFixedUsd: offer.commissionFixedUsd,
          niche: offer.niche,
          language: offer.language,
          region: offer.region,
          isTrending: offer.isTrending,
          qualityScore: scored.score,
          passesScamGate: scored.passes,
          scoreBreakdown: scored.breakdown,
        });
      }
    }

    scoredOffers.sort((a, b) => b.qualityScore - a.qualityScore);
    const topOffers = scoredOffers.slice(0, limit);

    return success({
      scannedCount: rawOffers.length,
      qualifiedCount: scoredOffers.length,
      networkBreakdown: breakdown,
      topOffers,
      completedAt: now,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('[discovery-wave] discovery wave execution failed', { error: error.message });
    return failure(error);
  }
}
