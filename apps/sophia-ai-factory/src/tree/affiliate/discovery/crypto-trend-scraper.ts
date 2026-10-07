/**
 * Crypto Trend Scraper
 *
 * Normalizes and filters trending crypto tokens and narratives from public discovery APIs.
 *
 * Layer: tree/affiliate/discovery (Domain Logic)
 * @module tree/affiliate/discovery/crypto-trend-scraper
 */

import type { DiscoveredCryptoTrend, NicheDiscoveryResult } from './trend-discovery-types';

export interface RawCoinGeckoTrendingItem {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number;
  data?: {
    price_change_percentage_24h?: {
      usd?: number;
    };
    total_volume?: string;
  };
  narrative?: string;
  slug?: string;
}

export function parseAndRankCryptoTrends(
  rawItems: RawCoinGeckoTrendingItem[],
  minVolumeUsd = 100000,
): NicheDiscoveryResult {
  const nowMs = Date.now();
  const validTrends: DiscoveredCryptoTrend[] = [];

  for (const item of rawItems) {
    if (!item.name || !item.symbol) continue;

    const priceChange = item.data?.price_change_percentage_24h?.usd ?? 0;
    const volume = Number(item.data?.total_volume?.replace(/[^0-9.]/g, '') || minVolumeUsd);

    let narrative: DiscoveredCryptoTrend['narrative'] = 'layer2_defi';
    const explicitNarrative = (item.narrative || '').toLowerCase();
    const textSample = `${item.name} ${item.symbol}`.toLowerCase();

    if (explicitNarrative.includes('sol') || explicitNarrative.includes('meme') || textSample.includes('bonk') || textSample.includes('doge') || textSample.includes('pepe')) {
      narrative = 'solana_meme';
    } else if (explicitNarrative.includes('ai') || textSample.includes('ai') || textSample.includes('agent') || textSample.includes('bot')) {
      narrative = 'ai_agent';
    } else if (explicitNarrative.includes('rwa') || textSample.includes('rwa') || textSample.includes('yield')) {
      narrative = 'rwa';
    } else if (explicitNarrative.includes('depin') || textSample.includes('depin') || textSample.includes('compute')) {
      narrative = 'depin';
    }

    validTrends.push({
      id: item.id || `crypto_${item.symbol.toLowerCase()}`,
      name: item.name.trim(),
      symbol: item.symbol.toUpperCase().trim(),
      narrative,
      marketCapRank: item.market_cap_rank || 100,
      priceChange24hPercent: priceChange,
      volume24hUsd: volume,
      explorerOrDexUrl: `https://dexscreener.com/search?q=${item.symbol}`,
      featuredSignal: priceChange > 15 ? 'BREAKOUT_SURGE' : 'HIGH_MOMENTUM',
    });
  }

  // Sort by price change percentage & momentum
  validTrends.sort((a, b) => b.priceChange24hPercent - a.priceChange24hPercent);

  return {
    niche: 'crypto_global',
    scrapedAtMs: nowMs,
    trends: validTrends,
    recommendedCampaignCandidate: validTrends.length > 0 ? validTrends[0] : null,
  };
}
