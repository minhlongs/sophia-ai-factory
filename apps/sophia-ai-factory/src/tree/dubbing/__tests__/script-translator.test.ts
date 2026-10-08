/**
 * @file script-translator.test.ts
 * @description Unit tests for Script Pacing Estimation and Regional Affiliate Routing
 */

import { describe, it, expect } from 'vitest';
import { estimatePacingMultiplier, mapRegionalAffiliateCta } from '@/tree/dubbing/script-translator';

describe('ScriptTranslator', () => {
  it('bounds pacing multiplier between 0.90 and 1.15', () => {
    // Normal case
    const normal = estimatePacingMultiplier(10, 42, 4.2);
    expect(normal.targetDurationSec).toBe(10.0);
    expect(normal.pacingMultiplier).toBe(1.0);
    expect(normal.isWithinPacingBounds).toBe(true);

    // Too fast case
    const tooFast = estimatePacingMultiplier(10, 60, 4.2);
    expect(tooFast.pacingMultiplier).toBe(1.15); // capped at 1.15

    // Too slow case
    const tooSlow = estimatePacingMultiplier(20, 20, 4.2);
    expect(tooSlow.pacingMultiplier).toBe(0.9); // floored at 0.9
  });

  it('routes correctly to regional affiliate networks and disclosures', () => {
    const vnCta = mapRegionalAffiliateCta('vi');
    expect(vnCta.networkName).toContain('Shopee');
    expect(vnCta.disclosureTag).toContain('#quangcao');

    const esCta = mapRegionalAffiliateCta('es');
    expect(esCta.networkName).toContain('Hotmart');
    expect(esCta.disclosureTag).toContain('#publicidad');

    const jaCta = mapRegionalAffiliateCta('ja');
    expect(jaCta.networkName).toContain('A8.net');
    expect(jaCta.disclosureTag).toContain('#PR');
  });

  it('prepends custom CTA prefix when provided', () => {
    const cta = mapRegionalAffiliateCta('en', 'Limited Time Deal:');
    expect(cta.defaultCtaText).toContain('Limited Time Deal:');
  });
});
