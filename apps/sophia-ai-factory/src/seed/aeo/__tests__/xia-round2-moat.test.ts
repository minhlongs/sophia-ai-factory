/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { buildAutoGeoPromptInstruction } from '../autogeo-citation-rules';
import { buildSophiaA2AExtension, X402_HEADERS } from '../x402-payment-contract';
import { atomizeScriptForOmnichannel, splitIntoXThread } from '@/seed/ai/content-atomizer';
import { buildAffiliateCampaignUserPrompt } from '@/seed/ai/affiliate-campaign-prompt';

describe('ak-xia Round 2: AutoGEO, Content Atomizer & A2A/x402 Live Wiring', () => {
  it('injects AutoGEO citation rules directly into affiliate campaign prompts', () => {
    const promptVi = buildAffiliateCampaignUserPrompt(
      {
        vertical: 'crypto',
        productName: 'Bybit',
        officialWebsiteUrl: 'https://bybit.com',
        referralUrl: 'https://bybit.com/register?affiliate_id=999',
        commissionTerms: '30% trading fee rebate',
        targetAudience: 'Crypto traders',
        targetMarket: 'VN',
        productInfoSource: 'Official partner portal',
      },
      30,
      'vi',
    );
    expect(promptVi).toContain('AutoGEO');
    expect(buildAutoGeoPromptInstruction('en')).toContain('Answer Engines');
  });

  it('atomizes one video script into <=280-char X thread, Telegram, and Reddit posts', () => {
    const thread = splitIntoXThread(['First hook', 'Second proof', 'Third CTA'], 280);
    expect(thread).toHaveLength(3);
    expect(thread[0]).toBe('1/3 First hook');

    const pack = atomizeScriptForOmnichannel({
      script: {
        title: 'Bybit 2026 Review',
        total_duration: 30,
        scenes: [
          { scene_number: 1, narration: 'Save 30% on fees with smart routing.', visual_description: 'UI', duration_estimate: 10 },
          { scene_number: 2, narration: 'Compare liquidity and execution speed.', visual_description: 'Chart', duration_estimate: 10 },
        ],
      },
      ctaText: 'Start here',
      shortUrl: 'https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/abc123',
      disclosureTag: '#ad',
    });

    expect(pack.xThread.every((t) => t.length <= 280)).toBe(true);
    expect(pack.telegramPost).toContain('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/r/abc123');
    expect(pack.redditPost).toContain('# Bybit 2026 Review');
  });

  it('exposes A2A v0.2 skills and non-custodial USDC x402 payment contract', () => {
    const a2a = buildSophiaA2AExtension();
    expect(a2a.protocol).toBe('A2A');
    expect(a2a.capabilities.opaqueTenantState).toBe(true);
    expect(a2a.skills.length).toBeGreaterThanOrEqual(3);
    expect(a2a.payment.protocol).toBe('x402');
    expect(a2a.payment.headers).toEqual(X402_HEADERS);
  });
});
