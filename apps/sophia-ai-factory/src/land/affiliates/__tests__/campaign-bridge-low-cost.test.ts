import { describe, it, expect } from 'vitest';
import {
  mapOfferToMissionInput,
  estimatePipelineCost,
  MONTHLY_MODEL_A_BUDGET_USD,
  isWithinModelABudget,
} from '@/land/affiliates/campaign-bridge-helpers';
import { getAffiliateWebhookReadiness } from '@/app/api/webhooks/affiliate/[network]/affiliate-network-configs';
import type { RankedDiscoveredOffer } from '@/land/affiliates/discovery-wave';

const sampleOffer: RankedDiscoveredOffer = {
  externalId: 'offer_101',
  network: 'clickbank',
  title: 'AI Automation Toolkit',
  description: 'Automate your business workflows with AI agents.',
  productUrl: 'https://example.com/toolkit',
  imageUrl: 'https://example.com/img.png',
  commissionPct: 50,
  commissionFixedUsd: null,
  niche: 'saas',
  language: 'en',
  region: 'US',
  isTrending: true,
  qualityScore: 88,
  passesScamGate: true,
  scoreBreakdown: {},
};

describe('Model A low-cost autonomous video pipeline & webhook readiness', () => {
  it('defaults Model A mission input to fish_speech ($0.005) + wan ($0.015) = $0.02/video', () => {
    const input = mapOfferToMissionInput(sampleOffer, { userId: 'founder_1' });
    expect(input.voiceProvider).toBe('fish_speech');
    expect(input.videoProvider).toBe('wan');
    expect(input.estimatedCostUsd).toBeCloseTo(0.02, 4);
  });

  it('enforces the $200/month Model A budget ceiling (<= 10,000 videos/month at $0.02)', () => {
    expect(MONTHLY_MODEL_A_BUDGET_USD).toBe(200);
    // 300 videos/day * 30 days = 9,000 videos/month * $0.02 = $180 <= $200
    expect(isWithinModelABudget(9000, 'fish_speech', 'wan')).toBe(true);
    // 11,000 videos/month * $0.02 = $220 > $200
    expect(isWithinModelABudget(11000, 'fish_speech', 'wan')).toBe(false);
    // Premium HeyGen + ElevenLabs at 60s costs $1.23/video; at default 30s costs $0.63/video -> 400 videos costs $252 > $200
    expect(estimatePipelineCost('elevenlabs', 'heygen', 60)).toBeCloseTo(1.23, 4);
    expect(isWithinModelABudget(400, 'elevenlabs', 'heygen')).toBe(false);
  });

  it('reports canonical affiliate network webhook readiness with boolean flags only', () => {
    const readiness = getAffiliateWebhookReadiness();
    expect(readiness.map((r) => r.network)).toEqual([
      'tiktok_shop',
      'amazon_associates',
      'clickbank',
      'accesstrade',
      'awin',
    ]);
    for (const item of readiness) {
      expect(typeof item.configured).toBe('boolean');
      expect(typeof item.secretEnv).toBe('string');
    }
  });
});
