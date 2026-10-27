/**
 * A01/A03: no unsourced claims, bonus, discount or timing promise reaches a
 * script or CTA, and VI/EN locale is explicit.
 */
import { describe, it, expect } from 'vitest';
import { getBlueprintById } from '@/seed/config/video-blueprints';
import { buildCryptoScriptPrompt } from '../crypto-script-prompt-builder';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { synthesizeNicheScript } from '@/tree/video/render/niche-script-synthesizer';

const cryptoBlueprint = getBlueprintById('crypto_fee_discount_signup_bonus')!;
const saasBlueprint = getBlueprintById('saas_problem_agitation_solution')!;

describe('crypto prompt facts provenance', () => {
  it('does NOT invent a 20% discount or $1000 bonus when the offer has no facts', () => {
    const prompts = buildCryptoScriptPrompt({ exchangeName: 'Binance', blueprint: cryptoBlueprint, locale: 'en' });
    expect(prompts.userPrompt).toContain('UNKNOWN');
    expect(prompts.userPrompt).toContain('Do NOT state any discount, bonus');
    expect(prompts.userPrompt).not.toContain('20%');
    expect(prompts.userPrompt).not.toContain('$1000');
  });

  it('only states facts that were explicitly supplied by the verified offer', () => {
    const prompts = buildCryptoScriptPrompt({
      exchangeName: 'Binance',
      blueprint: cryptoBlueprint,
      feeDiscountPct: 10,
      signupBonusUsd: 50,
      referralCode: 'VIP',
      locale: 'vi',
    });
    expect(prompts.userPrompt).toContain('10% fee discount');
    expect(prompts.userPrompt).toContain('$50 signup bonus');
    expect(prompts.userPrompt).toContain('VIP');
    expect(prompts.userPrompt).toContain('verified offer terms');
    expect(prompts.systemPrompt).toContain('Output language: Vietnamese');
  });
});

function plan(locale: 'en' | 'vi') {
  const result = createNicheVideoCampaignPlan({
    niche: 'saas_global',
    blueprintId: saasBlueprint.id,
    productName: 'Linear App',
    productUrl: 'https://linear.app',
    locale,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('script synthesis', () => {
  it('carries the locale explicitly and produces the correct language', () => {
    expect(plan('vi').locale).toBe('vi');
    const en = synthesizeNicheScript(plan('en'));
    const vi = synthesizeNicheScript(plan('vi'));
    expect(en.scenes[0]?.narrationText).toContain('Stop scrolling');
    expect(vi.scenes[0]?.narrationText).toContain('Dừng lướt');
    expect(synthesizeNicheScript(plan('en'), 'vi').scenes[0]?.narrationText).toContain('Dừng lướt');
  });

  it('never adds an unsourced exclusive bonus or a 60-second promise', () => {
    for (const p of [plan('en'), plan('vi')]) {
      const script = synthesizeNicheScript(p);
      expect(script.fullNarration.toLowerCase()).not.toContain('exclusive access bonus');
      expect(script.fullNarration.toLowerCase()).not.toContain('under 60 seconds');
      expect(script.fullNarration.toLowerCase()).not.toContain('60 giây');
      expect(script.fullNarration.toLowerCase()).not.toContain('ưu đãi độc quyền');
      expect(
        script.fullNarration.includes('commission') || script.fullNarration.includes('hoa hồng'),
      ).toBe(true);
    }
  });

  it('keeps the tracked link in the caption for the publish step', () => {
    const p = plan('en');
    expect(p.caption).toContain(p.trackedUrl);
  });
});
