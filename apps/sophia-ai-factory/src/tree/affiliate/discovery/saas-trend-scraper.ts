/**
 * SaaS Trend Scraper
 *
 * Parses and ranks emerging SaaS and AI products from discovery feeds (ProductHunt, BetaList).
 *
 * Layer: tree/affiliate/discovery (Domain Logic)
 * @module tree/affiliate/discovery/saas-trend-scraper
 */

import type { DiscoveredSaaSTrend, NicheDiscoveryResult } from './trend-discovery-types';

export interface RawProductHuntItem {
  id?: string;
  name: string;
  tagline: string;
  description?: string;
  url: string;
  votesCount?: number;
  category?: string;
  createdAt?: string;
}

export function parseAndRankSaaSTrends(
  rawItems: RawProductHuntItem[],
  minUpvotes = 20,
): NicheDiscoveryResult {
  const nowMs = Date.now();
  const validTrends: DiscoveredSaaSTrend[] = [];

  for (const item of rawItems) {
    const upvotes = item.votesCount ?? 0;
    if (upvotes < minUpvotes) continue;
    if (!item.name || !item.url) continue;

    let category: DiscoveredSaaSTrend['category'] = 'productivity';
    const textSample = `${item.name} ${item.tagline} ${item.description || ''} ${item.category || ''}`.toLowerCase();

    if (textSample.includes('ai') || textSample.includes('gpt') || textSample.includes('llm') || textSample.includes('agent')) {
      category = 'ai_tool';
    } else if (textSample.includes('dev') || textSample.includes('code') || textSample.includes('api') || textSample.includes('cloud')) {
      category = 'dev_tool';
    } else if (textSample.includes('seo') || textSample.includes('marketing') || textSample.includes('email') || textSample.includes('sales')) {
      category = 'marketing';
    }

    validTrends.push({
      id: item.id || `saas_${item.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: item.name.trim(),
      tagline: item.tagline.trim(),
      description: item.description?.trim() || item.tagline.trim(),
      productUrl: item.url.trim(),
      category,
      upvotes,
      featuredAt: item.createdAt || new Date(nowMs).toISOString(),
      estimatedCommissionPercent: 30, // standard default for B2B SaaS affiliates
    });
  }

  // Rank by upvotes descending
  validTrends.sort((a, b) => b.upvotes - a.upvotes);

  return {
    niche: 'saas_global',
    scrapedAtMs: nowMs,
    trends: validTrends,
    recommendedCampaignCandidate: validTrends.length > 0 ? validTrends[0] : null,
  };
}
