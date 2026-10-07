/**
 * Trend Discovery Types
 *
 * Defines contracts for automated scraping and discovery of trending
 * SaaS products and Crypto tokens for affiliate video generation.
 *
 * Layer: tree/affiliate/discovery (Domain Logic)
 * @module tree/affiliate/discovery/trend-discovery-types
 */

export type NicheTrendCategory = 'saas_global' | 'crypto_global';

export interface DiscoveredSaaSTrend {
  id: string;
  name: string;
  tagline: string;
  description: string;
  productUrl: string;
  category: 'ai_tool' | 'dev_tool' | 'productivity' | 'marketing';
  upvotes: number;
  featuredAt: string;
  estimatedCommissionPercent?: number;
}

export interface DiscoveredCryptoTrend {
  id: string;
  name: string;
  symbol: string;
  narrative: 'solana_meme' | 'ai_agent' | 'layer2_defi' | 'rwa' | 'depin';
  marketCapRank: number;
  priceChange24hPercent: number;
  volume24hUsd: number;
  explorerOrDexUrl: string;
  featuredSignal: string;
}

export interface NicheDiscoveryResult {
  niche: NicheTrendCategory;
  scrapedAtMs: number;
  trends: (DiscoveredSaaSTrend | DiscoveredCryptoTrend)[];
  recommendedCampaignCandidate: DiscoveredSaaSTrend | DiscoveredCryptoTrend | null;
}
