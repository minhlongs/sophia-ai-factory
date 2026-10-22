import { describe, expect, it } from 'vitest';
import { composePublishDescription } from '../publish-description';
import type { ComplianceGateResult } from '../distribution-compliance-gate';

const BASE = 'AI-generated video content for crypto beginners';

function verdict(overrides: Partial<ComplianceGateResult> = {}): ComplianceGateResult {
  return {
    allowed: true,
    detail: 'Regulated vertical permitted with disclosure.',
    vertical: 'crypto',
    requiresAffiliateDisclosure: true,
    requiresFinancialDisclaimer: true,
    ...overrides,
  };
}

describe('composePublishDescription', () => {
  it('places every mandated disclosure above the affiliate link', () => {
    const composed = composePublishDescription({
      baseDescription: BASE,
      offer: { productName: 'Exchange', shortUrl: 'https://sophia.agencyos.network/r/link0001' },
      verdict: verdict(),
      jurisdiction: 'US',
      locale: 'en',
    });

    expect(composed.blocked).toBe(false);
    expect(composed.affiliateDisclosureEmitted).toBe(true);
    expect(composed.financialDisclaimerEmitted).toBe(true);
    const linkAt = composed.description.indexOf('👉');
    expect(composed.description.indexOf('affiliate links')).toBeLessThan(linkAt);
    expect(composed.description.lastIndexOf('financial advice')).toBeLessThan(linkAt);
  });

  it('returns the base description untouched for a blocked verdict', () => {
    const composed = composePublishDescription({
      baseDescription: BASE,
      offer: { productName: 'Exchange', shortUrl: 'https://sophia.agencyos.network/r/link0001' },
      verdict: verdict({ allowed: false, reason: 'crypto_prohibited_in_jurisdiction', detail: 'Prohibited.' }),
      jurisdiction: 'VN',
      locale: 'en',
    });

    expect(composed.blocked).toBe(true);
    expect(composed.reason).toBe('crypto_prohibited_in_jurisdiction');
    expect(composed.description).toBe(BASE);
    expect(composed.description).not.toContain('👉');
  });

  it('treats a verdict whose mandated wording cannot be built as a block', () => {
    const composed = composePublishDescription({
      baseDescription: BASE,
      offer: { productName: 'Exchange', shortUrl: 'https://sophia.agencyos.network/r/link0003' },
      verdict: verdict(),
      jurisdiction: 'US',
      locale: 'en',
      // A disclaimer registry gap produces exactly this: no text at all. The
      // fail-closed guard must catch it rather than publish undisclosed.
      disclosureBuilder: () => '',
    });

    expect(composed.blocked).toBe(true);
    expect(composed.reason).toBe('disclosure_required');
    expect(composed.description).not.toContain('👉');
  });

  it('emits no wording when the verdict demands none', () => {
    const composed = composePublishDescription({
      baseDescription: BASE,
      offer: { productName: 'Tool', shortUrl: 'https://sophia.agencyos.network/r/link0002' },
      verdict: verdict({ requiresAffiliateDisclosure: false, requiresFinancialDisclaimer: false, vertical: 'other' }),
      jurisdiction: null,
      locale: 'en',
    });

    expect(composed.blocked).toBe(false);
    expect(composed.description).toBe(`${BASE}\n\n👉 https://sophia.agencyos.network/r/link0002`);
    expect(composed.affiliateDisclosureEmitted).toBe(false);
  });

  it('preserves a description with no offer and no verdict', () => {
    const composed = composePublishDescription({
      baseDescription: BASE,
      offer: null,
      verdict: null,
      jurisdiction: null,
      locale: 'en',
    });

    expect(composed.description).toBe(BASE);
    expect(composed.blocked).toBe(false);
  });
});
