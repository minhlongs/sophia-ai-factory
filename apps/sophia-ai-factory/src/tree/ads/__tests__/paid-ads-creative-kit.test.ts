/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { AffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';
import {
  buildPaidAdsCreativeKit,
  scanPaidAdsPolicyViolations,
} from '../paid-ads-creative-kit';

const CLEAN_PACK: AffiliateCampaignPack = {
  campaignTitle: 'Notion AI 2026 Workflow Review',
  audienceAnalysis: 'Small B2B SaaS teams.',
  valueProposition: 'Automates meeting notes and sprint docs with transparent pricing.',
  contentAngles: ['Speed', 'Workflow'],
  hook: 'See how small teams cut weekly documentation time in half.',
  callToAction: 'Read full breakdown: https://notion.so/?ref=pilot',
  shortFormScript: {
    title: 'Notion AI Review',
    total_duration: 30,
    scenes: [
      { scene_number: 1, title: 'Hook', narration: 'See how small teams cut doc time in half.', visual_description: 'v1', duration_estimate: 10 },
      { scene_number: 2, title: 'Proof', narration: 'Auto-summarizes meetings cleanly.', visual_description: 'v2', duration_estimate: 10 },
      { scene_number: 3, title: 'CTA', narration: 'Check the full review page below.', visual_description: 'v3', duration_estimate: 10 },
    ],
  },
  socialPost: 'Full review: https://notion.so/?ref=pilot #ad',
  affiliateDisclosure: '#ad Paid partner link',
  referralUrl: 'https://notion.so/?ref=pilot',
};

describe('Paid Ads Creative & Pre-Lander Kit', () => {
  it('flags banned EN and VI profit-guarantee phrases via Ad Policy Guard', () => {
    expect(scanPaidAdsPolicyViolations('Guaranteed profit with risk-free crypto')).toHaveLength(2);
    expect(scanPaidAdsPolicyViolations('Đảm bảo lợi nhuận X10 tài khoản')).toHaveLength(2);
    expect(scanPaidAdsPolicyViolations('Transparent SaaS workflow benchmark')).toHaveLength(0);
  });

  it('builds 3 platform variants pointing to clean Bridge Page /c/[slug] with UTM', () => {
    const kit = buildPaidAdsCreativeKit({
      pack: CLEAN_PACK,
      slug: 'notion-ai-2026',
    });
    expect(kit.policyStatus).toBe('SAFE');
    expect(kit.variants).toHaveLength(3);
    expect(kit.variants[0].bridgeDestinationUrl).toContain('/c/notion-ai-2026?utm_source=meta_ads');
    expect(kit.variants[1].bridgeDestinationUrl).toContain('/c/notion-ai-2026?utm_source=tiktok_ads');
    expect(kit.variants[2].bridgeDestinationUrl).toContain('/c/notion-ai-2026?utm_source=youtube_ads');
    expect(kit.variants[2].aspectRatio).toBe('16:9');

    const riskyKit = buildPaidAdsCreativeKit({
      pack: { ...CLEAN_PACK, hook: 'Guaranteed ROI and get rich quick today!' },
      slug: 'risky',
    });
    expect(riskyKit.policyStatus).toBe('RISK_DETECTED');
    expect(riskyKit.violations.length).toBeGreaterThanOrEqual(2);
  });
});
