/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { AffiliateCampaignPack } from '@/seed/ai/affiliate-campaign-prompt';
import { buildAffiliateCampaignUserPrompt } from '@/seed/ai/affiliate-campaign-prompt';
import { evaluateAffiliateCampaignPack } from '../video-script-eval-gate';
import { buildClickFeedbackPromptContext } from '../click-feedback-injector';

const STRONG_PACK: AffiliateCampaignPack = {
  campaignTitle: 'Notion AI 2026 Review',
  audienceAnalysis: 'Small B2B teams wanting faster docs.',
  valueProposition: 'Automates meeting notes and sprint summaries in 5 seconds.',
  contentAngles: ['Speed', 'ROI'],
  hook: 'Stop wasting 5 hours every week writing meeting notes manually.',
  callToAction: 'Try Notion AI free: https://notion.so/?ref=pilot',
  shortFormScript: {
    title: 'Notion AI 2026 Review',
    total_duration: 20,
    scenes: [
      { scene_number: 1, title: 'Hook', narration: 'Stop wasting five hours every week writing meeting notes manually.', visual_description: 'v1', duration_estimate: 6 },
      { scene_number: 2, title: 'Proof', narration: 'Notion AI summarizes every call and assigns action items in five seconds flat.', visual_description: 'v2', duration_estimate: 8 },
      { scene_number: 3, title: 'CTA', narration: 'Click the verified partner link below to test it free today.', visual_description: 'v3', duration_estimate: 6 },
    ],
  },
  socialPost: 'Try Notion AI today: https://notion.so/?ref=pilot #ad',
  affiliateDisclosure: '#ad Paid partner link',
  referralUrl: 'https://notion.so/?ref=pilot',
};

describe('Harness Eval Gate & Closed-Loop Click Feedback', () => {
  it('scores a compliant, well-paced script as PASS (100/100) and flags weak scripts as WARN', () => {
    const passReport = evaluateAffiliateCampaignPack(STRONG_PACK);
    expect(passReport.status).toBe('PASS');
    expect(passReport.totalScore).toBe(100);
    expect(passReport.checks.every((c) => c.passed)).toBe(true);

    const weakReport = evaluateAffiliateCampaignPack({
      ...STRONG_PACK,
      hook: 'Hi',
      callToAction: 'Buy now',
      affiliateDisclosure: '',
      shortFormScript: {
        title: 'Weak',
        total_duration: 60,
        scenes: [{ scene_number: 1, title: 'Only', narration: 'Hello', visual_description: 'v', duration_estimate: 60 }],
      },
    });
    expect(weakReport.status).toBe('WARN');
    expect(weakReport.totalScore).toBeLessThan(75);
  });

  it('builds closed-loop click feedback context only for links with verifiedClicks > 0 and injects into prompt', () => {
    expect(buildClickFeedbackPromptContext([])).toBe('');

    const ctx = buildClickFeedbackPromptContext([
      {
        id: 'l1',
        shortCode: 'abc',
        shortUrl: 'https://pilot.test/api/r/abc',
        destinationUrl: 'https://notion.so',
        ctaText: 'Get 40% off Notion AI',
        networkHint: 'generic',
        subId: 'sub_1',
        disclosureTag: '#ad',
        artifactId: 'a1',
        verifiedClicks: 14,
        createdAtIso: '2026-11-25T00:00:00Z',
      },
      {
        id: 'l2',
        shortCode: 'def',
        shortUrl: 'https://pilot.test/api/r/def',
        destinationUrl: 'https://notion.so',
        ctaText: 'Zero click CTA',
        networkHint: 'generic',
        subId: 'sub_1',
        disclosureTag: '#ad',
        artifactId: 'a2',
        verifiedClicks: 0,
        createdAtIso: '2026-11-25T00:00:00Z',
      },
    ]);

    expect(ctx).toContain('Get 40% off Notion AI');
    expect(ctx).toContain('14 verified clicks');
    expect(ctx).not.toContain('Zero click CTA');

    const prompt = buildAffiliateCampaignUserPrompt(
      {
        vertical: 'saas',
        productName: 'Notion AI',
        officialWebsiteUrl: 'https://notion.so',
        referralUrl: 'https://notion.so/?ref=pilot',
        commissionTerms: '20%',
        targetAudience: 'Teams',
        targetMarket: 'US',
        productInfoSource: 'Official',
      },
      30,
      'en',
      ctx,
    );
    expect(prompt).toContain('Winning Historical Signals');
  });
});
