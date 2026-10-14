/**
 * Provider registry, network context, and offer mapper for Agentic Affiliate Discovery Wave.
 * @module land/affiliates/discovery-wave-helpers
 */

import { ClickBankProvider } from './providers/clickbank';
import { AwinProvider } from './providers/awin';
import { ShareASaleProvider } from './providers/shareasale';
import type { AffiliateOffer, OfferProvider } from './provider-interface';
import type { Affiliate, Network } from './scout/types';

export interface RankedDiscoveredOffer {
  externalId: string;
  network: string;
  title: string;
  description: string;
  productUrl: string;
  imageUrl: string;
  commissionPct: number | null;
  commissionFixedUsd: number | null;
  niche: string;
  language: string;
  region: string;
  isTrending: boolean;
  qualityScore: number;
  passesScamGate: boolean;
  scoreBreakdown: Record<string, number>;
}

export interface DiscoveryWaveQuery {
  niche?: string;
  minScore?: number;
  limit?: number;
  networks?: ('clickbank' | 'awin' | 'shareasale')[];
  tenantId?: string;
}

export interface DiscoveryWaveResult {
  scannedCount: number;
  qualifiedCount: number;
  networkBreakdown: Record<string, number>;
  topOffers: RankedDiscoveredOffer[];
  completedAt: string;
}

export const PROVIDER_MAP: Record<'clickbank' | 'awin' | 'shareasale', () => OfferProvider> = {
  clickbank: () => new ClickBankProvider(),
  awin: () => new AwinProvider(),
  shareasale: () => new ShareASaleProvider(),
};

export const NETWORK_CTX: Record<string, { cookieDays: number; payoutFrequency: 'weekly' | 'monthly'; approvalRate: number }> = {
  clickbank: { cookieDays: 60, payoutFrequency: 'weekly', approvalRate: 0.9 },
  awin: { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.75 },
  shareasale: { cookieDays: 45, payoutFrequency: 'monthly', approvalRate: 0.8 },
};

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function toAffiliate(
  offer: AffiliateOffer,
  network: Network,
  tenantId: string,
  now: string,
): Affiliate {
  const epc =
    offer.commissionPct != null
      ? Math.min(10, Math.max(0.5, (offer.commissionPct / 100) * 8))
      : offer.commissionFixedUsd != null
        ? Math.min(10, Math.max(0.5, offer.commissionFixedUsd * 0.05))
        : 1.0;

  return {
    id: `aff_${network}_${offer.externalId}`,
    tenantId,
    network,
    externalId: offer.externalId,
    productName: offer.title,
    productUrl: offer.productUrl,
    commissionPct: offer.commissionPct ?? undefined,
    commissionFlatUsd: offer.commissionFixedUsd ?? undefined,
    category: offer.niche,
    description: offer.description,
    discoveredAt: now,
    epc,
    domain: extractDomain(offer.productUrl),
  };
}
