/**
 * Niche Trend Auto-Discovery Job
 *
 * Inngest/Cron worker that periodically fetches trending SaaS products
 * and Crypto tokens, populates discovery feeds, and triggers campaign generation.
 *
 * Layer: forest/cron (Background Job)
 * @module forest/cron/niche-trend-auto-discovery-job
 */

import { inngest } from '@/seed/inngest/client';
import { parseAndRankSaaSTrends, type RawProductHuntItem } from '@/tree/affiliate/discovery/saas-trend-scraper';
import { parseAndRankCryptoTrends, type RawCoinGeckoTrendingItem } from '@/tree/affiliate/discovery/crypto-trend-scraper';
import type { DiscoveredSaaSTrend, DiscoveredCryptoTrend } from '@/tree/affiliate/discovery/trend-discovery-types';

// TODO: Replace with real API fetchers once service layer is integrated
// This job acts as the backbone for the Trend Discovery flywheel.
export const nicheTrendAutoDiscoveryJob = inngest.createFunction(
  { id: 'niche-trend-auto-discovery-job', name: 'Niche Trend Auto Discovery' },
  { cron: '0 * * * *' }, // Hourly discovery
  async ({ step }) => {
    // 1. Fetch data from external aggregators (ProductHunt / CoinGecko)
    const saasData = await step.run('fetch-saas-trends', async (): Promise<RawProductHuntItem[]> => {
      return [];
    });

    const cryptoData = await step.run('fetch-crypto-trends', async (): Promise<RawCoinGeckoTrendingItem[]> => {
      return [];
    });

    // 2. Process and Rank
    const saasResults = parseAndRankSaaSTrends(saasData);
    const cryptoResults = parseAndRankCryptoTrends(cryptoData);

    // 3. Dispatch for Campaign Generation
    if (saasResults.recommendedCampaignCandidate) {
      const saasCandidate = saasResults.recommendedCampaignCandidate as DiscoveredSaaSTrend;
      await inngest.send({
        name: 'niche.video.campaign.requested',
        data: {
          userId: 'system',
          niche: 'saas_global',
          blueprintId: 'default',
          productName: saasCandidate.name,
          productUrl: saasCandidate.productUrl,
        },
      });
    }

    if (cryptoResults.recommendedCampaignCandidate) {
      const cryptoCandidate = cryptoResults.recommendedCampaignCandidate as DiscoveredCryptoTrend;
      await inngest.send({
        name: 'niche.video.campaign.requested',
        data: {
          userId: 'system',
          niche: 'crypto_global',
          blueprintId: 'default',
          productName: cryptoCandidate.name,
          productUrl: cryptoCandidate.explorerOrDexUrl,
        },
      });
    }

    return { saasExecuted: true, cryptoExecuted: true };
  }
);
