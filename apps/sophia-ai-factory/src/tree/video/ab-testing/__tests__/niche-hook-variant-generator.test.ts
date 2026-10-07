/**
 * Unit Tests for Hook Variant Generator
 *
 * Validates generation of diverse psychological hooks with retention projections.
 * @module tree/video/ab-testing/__tests__/niche-hook-variant-generator.test
 */

import { describe, it, expect } from 'vitest';
import { generateHookVariants } from '../niche-hook-variant-generator';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';

describe('Hook Variant Generator', () => {
  it('generates 4 distinct psychological hook variants', () => {
    const planRes = createNicheVideoCampaignPlan({
      niche: 'saas_global',
      blueprintId: 'saas_problem_agitation_solution',
      productName: 'SophiaAgent',
      productUrl: 'https://sophia.ai',
      affiliateCode: 'partner_1',
      locale: 'en',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    const pkg = generateHookVariants(planRes.value, 'en');
    expect(pkg.variants.length).toBe(4);

    // Check coverage of all angles
    const angles = pkg.variants.map((v) => v.angle);
    expect(angles).toContain('curiosity_gap');
    expect(angles).toContain('loss_aversion');
    expect(angles).toContain('shocking_stat');
    expect(angles).toContain('instant_benefit');
  });

  it('generates appropriate crypto-specific narratives', () => {
    const planRes = createNicheVideoCampaignPlan({
      niche: 'crypto_global',
      blueprintId: 'crypto_fee_discount_signup_bonus',
      productName: 'BinanceBot',
      productUrl: 'https://binance.com',
      affiliateCode: 'vip_1',
      locale: 'en',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    const pkg = generateHookVariants(planRes.value, 'en');
    const curiosityHook = pkg.variants.find((v) => v.angle === 'curiosity_gap');
    expect(curiosityHook?.narration).toContain('traders');
  });

  it('sets a recommended variant based on retention scores', () => {
    const planRes = createNicheVideoCampaignPlan({
      niche: 'saas_global',
      blueprintId: 'saas_problem_agitation_solution',
      productName: 'SophiaAgent',
      productUrl: 'https://sophia.ai',
      affiliateCode: 'partner_1',
      locale: 'en',
    });

    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;

    const pkg = generateHookVariants(planRes.value, 'en');
    const rec = pkg.variants.find((v) => v.id === pkg.recommendedVariantId);

    expect(rec).toBeDefined();
    for (const v of pkg.variants) {
      expect(v.estimatedRetentionScore).toBeLessThanOrEqual(rec!.estimatedRetentionScore);
    }
  });
});
