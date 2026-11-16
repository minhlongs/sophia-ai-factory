/**
 * Provider registry, network context, and offer mapper for Agentic Affiliate Discovery Wave.
 * @module land/affiliates/discovery-wave-helpers
 */

import { ClickBankProvider } from './providers/clickbank';
import { AwinProvider } from './providers/awin';
import { ShareASaleProvider } from './providers/shareasale';
import { ScoutClientOfferProvider } from './providers/scout-client-adapter';
import { partnerstackClient } from './scout/client-partnerstack';
import { impactRadiusClient } from './scout/client-impact-radius';
import { cjClient } from './scout/client-cj';
import { binanceClient } from './scout/client-binance';
import { bybitClient } from './scout/client-bybit';
import { bitgetClient } from './scout/client-bitget';
import { coinbaseClient } from './scout/client-coinbase';
import type { AffiliateOffer, OfferProvider } from './provider-interface';
import type { Affiliate, Network } from './scout/types';
import { getCredentials, type AffiliateNetwork } from '@/land/affiliates/credentials';

export type SupportedDiscoveryNetwork =
  | 'clickbank' | 'awin' | 'shareasale' | 'partnerstack'
  | 'impact' | 'cj' | 'binance' | 'bybit' | 'bitget' | 'coinbase';

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
  networks?: SupportedDiscoveryNetwork[];
  tenantId?: string;
  db?: D1Database;
  allowMockFallback?: boolean;
}

export interface DiscoveryWaveResult {
  scannedCount: number;
  qualifiedCount: number;
  networkBreakdown: Record<string, number>;
  topOffers: RankedDiscoveredOffer[];
  completedAt: string;
  providerErrors?: Record<string, string>;
}

export async function createTenantOfferProvider(
  networkKey: SupportedDiscoveryNetwork,
  tenantId: string,
  db?: D1Database,
  allowMockFallback: boolean = false,
): Promise<OfferProvider> {
  const credsMap: Record<string, string> = {};
  if (db) {
    const credNetwork = networkKey === 'impact' ? 'impact_radius' : networkKey;
    const cred = await getCredentials(db, tenantId, credNetwork as AffiliateNetwork).catch(() => null);
    if (cred) {
      Object.assign(credsMap, cred as unknown as Record<string, string>);
    }
  }

  switch (networkKey) {
    case 'clickbank':
      return new ClickBankProvider({
        apiKey: credsMap.api_key,
        allowMockFallback,
      });
    case 'awin':
      return new AwinProvider({
        apiToken: credsMap.api_token,
        publisherId: credsMap.publisher_id,
        allowMockFallback,
      });
    case 'shareasale':
      return new ShareASaleProvider({
        apiToken: credsMap.api_token,
        affiliateId: credsMap.affiliate_id,
        allowMockFallback,
      });
    case 'partnerstack':
      return new ScoutClientOfferProvider(partnerstackClient, process.env as never, tenantId, credsMap);
    case 'impact':
      return new ScoutClientOfferProvider(impactRadiusClient, process.env as never, tenantId, credsMap);
    case 'cj':
      return new ScoutClientOfferProvider(cjClient, process.env as never, tenantId, credsMap);
    case 'binance':
      return new ScoutClientOfferProvider(binanceClient, process.env as never, tenantId, credsMap);
    case 'bybit':
      return new ScoutClientOfferProvider(bybitClient, process.env as never, tenantId, credsMap);
    case 'bitget':
      return new ScoutClientOfferProvider(bitgetClient, process.env as never, tenantId, credsMap);
    case 'coinbase':
      return new ScoutClientOfferProvider(coinbaseClient, process.env as never, tenantId, credsMap);
    default:
      throw new Error(`Unsupported network: ${networkKey}`);
  }
}

export const PROVIDER_MAP: Record<SupportedDiscoveryNetwork, () => OfferProvider> = {
  clickbank: () => new ClickBankProvider(),
  awin: () => new AwinProvider(),
  shareasale: () => new ShareASaleProvider(),
  partnerstack: () => new ScoutClientOfferProvider(partnerstackClient),
  impact: () => new ScoutClientOfferProvider(impactRadiusClient),
  cj: () => new ScoutClientOfferProvider(cjClient),
  binance: () => new ScoutClientOfferProvider(binanceClient),
  bybit: () => new ScoutClientOfferProvider(bybitClient),
  bitget: () => new ScoutClientOfferProvider(bitgetClient),
  coinbase: () => new ScoutClientOfferProvider(coinbaseClient),
};

export const NETWORK_CTX: Record<string, { cookieDays: number; payoutFrequency: 'weekly' | 'monthly'; approvalRate: number }> = {
  clickbank: { cookieDays: 60, payoutFrequency: 'weekly', approvalRate: 0.9 },
  awin: { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.75 },
  shareasale: { cookieDays: 45, payoutFrequency: 'monthly', approvalRate: 0.8 },
  partnerstack: { cookieDays: 90, payoutFrequency: 'monthly', approvalRate: 0.85 },
  impact: { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.8 },
  cj: { cookieDays: 30, payoutFrequency: 'monthly', approvalRate: 0.8 },
  binance: { cookieDays: 90, payoutFrequency: 'weekly', approvalRate: 0.95 },
  bybit: { cookieDays: 90, payoutFrequency: 'weekly', approvalRate: 0.95 },
  bitget: { cookieDays: 90, payoutFrequency: 'weekly', approvalRate: 0.95 },
  coinbase: { cookieDays: 90, payoutFrequency: 'monthly', approvalRate: 0.95 },
};

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function toAffiliate(offer: AffiliateOffer, network: Network, tenantId: string, now: string): Affiliate {
  const epc = offer.commissionPct != null
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
