/**
 * Tests for the distribution compliance gate.
 *
 * The gate decides whether a campaign video may be published. Its contract is
 * deliberately conservative: regulated verticals with an unknown jurisdiction
 * must be blocked, because a wrongly published financial promotion cannot be
 * cheaply undone.
 */

import { describe, it, expect } from 'vitest';
import { evaluateDistributionLegality, buildPublishDisclosure } from '../distribution-compliance-gate';

describe('non-regulated verticals pass through', () => {
  it('allows a SaaS offer with no jurisdiction check', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Workflow',
      offerName: 'SmartSuite',
      jurisdiction: null,
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.vertical).toBe('saas');
    expect(result.requiresFinancialDisclaimer).toBe(false);
    expect(result.requiresAffiliateDisclosure).toBe(true);
  });

  it('allows an ecommerce offer even with unknown jurisdiction', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'E-Commerce',
      offerName: 'Shopify',
      jurisdiction: undefined,
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.vertical).toBe('ecommerce');
  });

  it('allows content with no offer attached at all', () => {
    const result = evaluateDistributionLegality({
      offerCategory: null,
      offerName: null,
      jurisdiction: null,
      hasAffiliateLink: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresAffiliateDisclosure).toBe(false);
  });
});

describe('crypto is blocked in jurisdictions where promotion is prohibited', () => {
  it('blocks crypto for VN (Decree 52/2024/ND-CP)', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Crypto Exchange',
      offerName: 'KuCoin',
      jurisdiction: 'VN',
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('crypto_prohibited_in_jurisdiction');
    expect(result.vertical).toBe('crypto');
    expect(result.requiresFinancialDisclaimer).toBe(false);
  });

  it('blocks trading content for VN', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Trading Platform',
      offerName: 'Futures copy trading',
      jurisdiction: 'VN',
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('crypto_prohibited_in_jurisdiction');
  });
});

describe('crypto in permitted jurisdictions requires a disclaimer', () => {
  it('allows crypto for US with disclaimer required', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Crypto Exchange',
      offerName: 'KuCoin Trading Rebate',
      jurisdiction: 'US',
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresFinancialDisclaimer).toBe(true);
    expect(result.requiresAffiliateDisclosure).toBe(true);
    expect(result.detail).toContain('US');
  });

  it('allows crypto for EU with disclaimer required', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Crypto',
      jurisdiction: 'EU',
      hasAffiliateLink: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresFinancialDisclaimer).toBe(true);
  });

  it('allows trading for JP with disclaimer required', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Trading Platform',
      jurisdiction: 'JP',
      hasAffiliateLink: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.vertical).toBe('trading');
    expect(result.requiresFinancialDisclaimer).toBe(true);
  });
});

describe('regulated vertical with unknown jurisdiction is fail-closed', () => {
  it('blocks crypto when jurisdiction is null', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Crypto Exchange',
      offerName: 'Binance',
      jurisdiction: null,
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('jurisdiction_unknown');
  });

  it('blocks crypto when jurisdiction is an empty string', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Crypto',
      jurisdiction: '',
      hasAffiliateLink: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('jurisdiction_unknown');
  });

  it('blocks trading when jurisdiction is only whitespace', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Trading',
      jurisdiction: '   ',
      hasAffiliateLink: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('jurisdiction_unknown');
  });
});

describe('vertical classification never downgrades a regulated offer', () => {
  it('treats a "crypto workflow SaaS" as crypto, not saas', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'SaaS',
      offerName: 'Crypto payment workflow automation',
      jurisdiction: 'VN',
      hasAffiliateLink: true,
    });
    expect(result.vertical).toBe('crypto');
    expect(result.allowed).toBe(false);
  });

  it('treats "Bitcoin" as crypto regardless of category wording', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'unclear',
      offerName: 'Bitcoin trading guide',
      jurisdiction: 'US',
      hasAffiliateLink: false,
    });
    expect(result.vertical).toBe('crypto');
    expect(result.requiresFinancialDisclaimer).toBe(true);
  });
});

describe('reason precedence', () => {
  it('reports the prohibition reason over the disclaimer requirement', () => {
    const result = evaluateDistributionLegality({
      offerCategory: 'Crypto',
      jurisdiction: 'VN',
      hasAffiliateLink: true,
    });
    expect(result.reason).toBe('crypto_prohibited_in_jurisdiction');
    expect(result.allowed).toBe(false);
  });
});

describe('buildPublishDisclosure', () => {
  it('adds both affiliate and financial disclosure for US crypto', () => {
    const verdict = evaluateDistributionLegality({
      offerCategory: 'Crypto Exchange',
      offerName: 'KuCoin',
      jurisdiction: 'US',
      hasAffiliateLink: true,
    });
    const text = buildPublishDisclosure(verdict, 'US', 'en');
    expect(text).toContain('affiliate links');
    expect(text).toContain('Not financial advice');
  });

  it('adds only the affiliate disclosure for an unregulated vertical', () => {
    const verdict = evaluateDistributionLegality({
      offerCategory: 'Workflow',
      offerName: 'SmartSuite',
      jurisdiction: null,
      hasAffiliateLink: true,
    });
    const text = buildPublishDisclosure(verdict, null, 'en');
    expect(text).toContain('affiliate links');
    expect(text).not.toContain('Not financial advice');
  });

  it('returns nothing when nothing is required', () => {
    const verdict = evaluateDistributionLegality({
      offerCategory: null,
      offerName: null,
      jurisdiction: null,
      hasAffiliateLink: false,
    });
    expect(buildPublishDisclosure(verdict, null, 'en')).toBe('');
  });

  it('falls back to the US wording for an unknown jurisdiction', () => {
    const verdict = evaluateDistributionLegality({
      offerCategory: 'Crypto',
      jurisdiction: 'US',
      hasAffiliateLink: true,
    });
    const text = buildPublishDisclosure(verdict, 'ZZ', 'en');
    expect(text).toContain('affiliate links');
    expect(text).toContain('Not financial advice');
  });
})
