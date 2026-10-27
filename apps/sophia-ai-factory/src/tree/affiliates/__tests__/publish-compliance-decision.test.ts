import { describe, expect, it } from 'vitest';
import { decidePublishCompliance } from '../publish-compliance-decision';

const BASE = 'AI-generated video content for crypto beginners';

function offer(name: string, category: string | null = 'crypto') {
  return { productName: name, shortUrl: 'https://sophia.agencyos.network/r/abc12345', category };
}

describe('decidePublishCompliance', () => {
  it('publishes a crypto offer into a permitted jurisdiction with both disclosures', () => {
    const decision = decidePublishCompliance({
      baseDescription: BASE,
      offer: offer('BingX Crypto Exchange'),
      jurisdiction: 'US',
      locale: 'en',
    });

    expect(decision.mayPublish).toBe(true);
    expect(decision.description).toContain('affiliate links');
    expect(decision.description).toContain('👉 https://sophia.agencyos.network/r/abc12345');
    expect(decision.affiliateDisclosureEmitted).toBe(true);
  });

  it('withholds a crypto offer into a jurisdiction where promotion is prohibited', () => {
    const decision = decidePublishCompliance({
      baseDescription: BASE,
      offer: offer('BingX Crypto Exchange'),
      jurisdiction: 'VN',
      locale: 'en',
    });

    expect(decision.mayPublish).toBe(false);
    expect(decision.reason).toBe('crypto_prohibited_in_jurisdiction');
    // The withheld description must not carry the link it refused to publish.
    expect(decision.description).not.toContain('/r/abc12345');
  });

  it('fails closed when the vertical is regulated but the jurisdiction is unknown', () => {
    const decision = decidePublishCompliance({
      baseDescription: BASE,
      offer: offer('BingX Crypto Exchange'),
      jurisdiction: null,
      locale: 'en',
    });

    expect(decision.mayPublish).toBe(false);
    expect(decision.reason).toBe('jurisdiction_unknown');
  });

  it('keeps unregulated SaaS publishing allowed without a declared jurisdiction', () => {
    const saas = { productName: 'Notion Team', shortUrl: 'https://sophia.agencyos.network/r/saas1234', category: 'saas' as string | null };
    const decision = decidePublishCompliance({
      baseDescription: 'AI-generated video content for productivity teams',
      offer: saas,
      jurisdiction: null,
      locale: 'en',
    });

    expect(decision.mayPublish).toBe(true);
    // No jurisdiction was declared, and none was required: the proof that
    // enabling the gate does not block ordinary campaigns.
    expect(decision.reason).toBeUndefined();
    // The link is still published. A disclosure line now precedes it, which is
    // the intended change: an affiliate link without a disclosure is the
    // violation this gate exists to stop. Financial disclaimer stays absent.
    expect(decision.description).toContain('👉 https://sophia.agencyos.network/r/saas1234');
    expect(decision.description).toContain('This content contains affiliate links');
    expect(decision.financialDisclaimerEmitted).toBe(false);
    expect(decision.description.indexOf('affiliate links')).toBeLessThan(
      decision.description.indexOf('👉'),
    );
  });

  it('emits the affiliate disclosure for a link in a non-financial vertical', () => {
    const decision = decidePublishCompliance({
      baseDescription: 'AI-generated video content for productivity teams',
      offer: { productName: 'Notion Team', shortUrl: 'https://sophia.agencyos.network/r/saas1234', category: 'saas' },
      jurisdiction: 'US',
      locale: 'en',
    });

    expect(decision.mayPublish).toBe(true);
    expect(decision.affiliateDisclosureEmitted).toBe(true);
    expect(decision.financialDisclaimerEmitted).toBe(false);
  });

  it('leaves a campaign with no offer on its original description', () => {
    const decision = decidePublishCompliance({
      baseDescription: BASE,
      offer: null,
      jurisdiction: null,
      locale: 'en',
    });

    expect(decision.mayPublish).toBe(true);
    expect(decision.description).toBe(BASE);
    expect(decision.affiliateDisclosureEmitted).toBe(false);
  });

  it('renders Vietnamese disclosure wording when the audience is Vietnamese', () => {
    const decision = decidePublishCompliance({
      baseDescription: BASE,
      offer: offer('BingX Crypto Exchange'),
      jurisdiction: 'US',
      locale: 'vi',
    });

    expect(decision.mayPublish).toBe(true);
    expect(decision.description).toContain('liên kết affiliate');
  });

  it('classifies a crypto vertical from the offer name alone', () => {
    const decision = decidePublishCompliance({
      baseDescription: BASE,
      offer: offer('Bitcoin Trading Masterclass', null),
      jurisdiction: 'VN',
      locale: 'en',
    });

    expect(decision.vertical).toBe('crypto');
    expect(decision.mayPublish).toBe(false);
  });
});
