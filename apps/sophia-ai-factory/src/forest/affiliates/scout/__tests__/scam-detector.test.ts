/**
 * Tests for scam risk detection.
 */

import { describe, it, expect } from 'vitest';
import { detectScamRisk } from '../scam-detector';
import type { Affiliate } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAffiliate(overrides: Partial<Affiliate> = {}): Affiliate {
  return {
    id: 'test-id',
    tenantId: 'tenant-1',
    network: 'mock',
    externalId: 'ext-001',
    productName: 'Test Product',
    discoveredAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectScamRisk', () => {
  it('clean affiliate returns low scam risk', () => {
    const aff = makeAffiliate({
      productName: 'Shopify Affiliate Program',
      productUrl: 'https://shopify.com/affiliates',
    });
    const result = detectScamRisk(aff);

    expect(result.scamRisk).toBeLessThan(0.3);
    expect(result.signals).toHaveLength(0);
  });

  it('blacklisted domain triggers high scam risk', () => {
    const aff = makeAffiliate({
      productName: 'Free Money Fast',
      productUrl: 'https://free-money-now.com/join',
    });
    const result = detectScamRisk(aff);

    // blacklistedDomain weight = 0.40 alone
    expect(result.scamRisk).toBeGreaterThanOrEqual(0.4);
    expect(result.breakdown.blacklistedDomain).toBe(1);
    expect(result.signals.some((s) => s.startsWith('blacklisted-domain'))).toBe(true);
  });

  it('suspicious TLD (.tk) increases scam risk', () => {
    const aff = makeAffiliate({
      productName: 'Investment Platform',
      productUrl: 'https://invest-profit.tk',
    });
    const result = detectScamRisk(aff);

    expect(result.breakdown.suspiciousTld).toBe(1);
    expect(result.signals.some((s) => s.startsWith('suspicious-tld'))).toBe(true);
  });

  it('MLM keywords in description increase scam risk', () => {
    const aff = makeAffiliate({
      productName: 'Super Opportunity',
      description: 'Join our network marketing team, recruit friends for your downline and earn passive income guaranteed.',
    });
    const result = detectScamRisk(aff);

    expect(result.breakdown.mlmKeywords).toBeGreaterThan(0);
    expect(result.signals.some((s) => s.startsWith('mlm-keywords'))).toBe(true);
  });

  it('scam phrases in product name trigger signal', () => {
    const aff = makeAffiliate({
      productName: 'Millionaire Secret System — quit your job today',
      description: 'Automated money machine, set and forget.',
    });
    const result = detectScamRisk(aff);

    expect(result.breakdown.scamPhrases).toBeGreaterThan(0);
  });

  it('copycat brand name triggers signal', () => {
    const aff = makeAffiliate({
      productName: 'Binance Pro Exchange',
      productUrl: 'https://binance-pro-exchange.xyz/affiliate',
    });
    const result = detectScamRisk(aff);

    expect(result.breakdown.copycatBrand).toBe(1);
    expect(result.signals.some((s) => s.startsWith('copycat-brand'))).toBe(true);
  });

  it('real Binance URL does NOT trigger copycat signal', () => {
    const aff = makeAffiliate({
      productName: 'Binance Affiliate',
      productUrl: 'https://binance.com/en/activity/affiliate',
    });
    const result = detectScamRisk(aff);

    expect(result.breakdown.copycatBrand).toBe(0);
  });

  it('multiple signals compound to scam risk >= 0.5', () => {
    const aff = makeAffiliate({
      productName: 'Ponzi Pay — Double Your Money',
      productUrl: 'https://ponzi-pay.com/join',
      description: 'Guaranteed ROI. Recruit members for your downline. No questions asked.',
    });
    const result = detectScamRisk(aff);

    // blacklisted + mlm + scam phrases should push over 0.5
    expect(result.scamRisk).toBeGreaterThanOrEqual(0.5);
  });

  it('affiliate with no URL or description has scamRisk 0', () => {
    const aff = makeAffiliate();
    const result = detectScamRisk(aff);

    expect(result.scamRisk).toBe(0);
    expect(result.signals).toHaveLength(0);
  });

  it('scamRisk is capped at 1.0', () => {
    const aff = makeAffiliate({
      productName: 'Ponzi Pyramid MLM guaranteed roi double your money network marketing',
      productUrl: 'https://ponzi-pay.com/secret-system-quit-your-job',
      description: 'Recruit friends downline upline matrix plan automated money machine',
      domain: 'ponzi-pay.com',
    });
    const result = detectScamRisk(aff);

    expect(result.scamRisk).toBeLessThanOrEqual(1.0);
    expect(result.scamRisk).toBeGreaterThanOrEqual(0);
  });

  it('breakdown values are all 0..1', () => {
    const aff = makeAffiliate({
      productName: 'Crypto MLM guaranteed roi pyramid',
      productUrl: 'https://free-money-now.com/plan.tk',
    });
    const result = detectScamRisk(aff);

    for (const val of Object.values(result.breakdown)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});
