import { describe, expect, it } from 'vitest';
import {
  buildAffiliateCampaignUserPrompt,
  buildMandatoryAffiliateDisclosure,
  buildSimulatedAffiliateCampaignPack,
  normalizeAndValidateCampaignPack,
  resolveEffectiveContentLanguage,
  type AffiliateOfferBrief,
  type CampaignContentLanguage,
} from '@/seed/ai/affiliate-campaign-prompt';

function makeOffer(targetMarket: string, vertical: 'saas' | 'crypto' = 'saas'): AffiliateOfferBrief {
  return {
    vertical,
    productName: 'Sophia Cloud Suite',
    officialWebsiteUrl: 'https://sophia.example.com',
    referralUrl: 'https://sophia.example.com/?ref=pilot-user-01',
    commissionTerms: '30% recurring commission',
    targetAudience: 'Small business founders',
    targetMarket,
    productInfoSource: 'Official partner portal',
  };
}

describe('Track B: Pilot Language Contract Regression Matrix', () => {
  const matrix: ReadonlyArray<{
    readonly label: string;
    readonly uiLocale: 'vi' | 'en';
    readonly targetMarket: string;
    readonly explicitContentLanguage: CampaignContentLanguage;
    readonly expectedPromptSnippet: string;
    readonly expectedDisclosureSnippet: string;
  }> = [
    {
      label: 'vi/US/en',
      uiLocale: 'vi',
      targetMarket: 'US',
      explicitContentLanguage: 'en',
      expectedPromptSnippet: 'business English',
      expectedDisclosureSnippet: '#ad | This content contains an affiliate referral link.',
    },
    {
      label: 'en/VN/vi',
      uiLocale: 'en',
      targetMarket: 'VN',
      explicitContentLanguage: 'vi',
      expectedPromptSnippet: 'business Vietnamese',
      expectedDisclosureSnippet: '#QuảngCáo | Nội dung này có chứa liên kết giới thiệu',
    },
    {
      label: 'vi/VN/vi',
      uiLocale: 'vi',
      targetMarket: 'VN',
      explicitContentLanguage: 'vi',
      expectedPromptSnippet: 'business Vietnamese',
      expectedDisclosureSnippet: '#QuảngCáo | Nội dung này có chứa liên kết giới thiệu',
    },
    {
      label: 'en/US/en',
      uiLocale: 'en',
      targetMarket: 'US',
      explicitContentLanguage: 'en',
      expectedPromptSnippet: 'business English',
      expectedDisclosureSnippet: '#ad | This content contains an affiliate referral link.',
    },
    {
      label: 'vi/US/es',
      uiLocale: 'vi',
      targetMarket: 'US',
      explicitContentLanguage: 'es',
      expectedPromptSnippet: 'business Spanish',
      expectedDisclosureSnippet: '#ad | Este contenido contiene un enlace de afiliado.',
    },
  ];

  it.each(matrix)(
    'separates UI locale, target market, and explicit content language for $label',
    ({ targetMarket, explicitContentLanguage, expectedPromptSnippet, expectedDisclosureSnippet }) => {
      const effective = resolveEffectiveContentLanguage({
        contentLanguage: explicitContentLanguage,
        targetMarket,
      });
      expect(effective).toBe(explicitContentLanguage);

      const offer = makeOffer(targetMarket);
      const prompt = buildAffiliateCampaignUserPrompt(offer, 30, effective);
      expect(prompt).toContain(expectedPromptSnippet);
      expect(prompt).toContain(offer.referralUrl);

      const disclosure = buildMandatoryAffiliateDisclosure(offer.vertical, offer.targetMarket, effective);
      expect(disclosure).toContain(expectedDisclosureSnippet);

      const simulated = buildSimulatedAffiliateCampaignPack(offer, 30, effective);
      expect(simulated.contentLanguage).toBe(explicitContentLanguage);
      expect(simulated.referralUrl).toBe(offer.referralUrl);
      expect(simulated.callToAction).toContain(offer.referralUrl);
      expect(simulated.socialPost).toContain(offer.referralUrl);
      expect(simulated.affiliateDisclosure).toContain(expectedDisclosureSnippet);
    },
  );

  it('handles legacy saved campaigns without contentLanguage by falling back to targetMarket default', () => {
    expect(resolveEffectiveContentLanguage({ targetMarket: 'VN' })).toBe('vi');
    expect(resolveEffectiveContentLanguage({ targetMarket: 'US' })).toBe('en');
    expect(resolveEffectiveContentLanguage({ targetMarket: 'EU' })).toBe('en');
  });

  it('preserves saved packContentLanguage on edit and allows explicit override on regeneration', () => {
    expect(
      resolveEffectiveContentLanguage({
        packContentLanguage: 'es',
        targetMarket: 'US',
      }),
    ).toBe('es');

    expect(
      resolveEffectiveContentLanguage({
        contentLanguage: 'en',
        packContentLanguage: 'es',
        targetMarket: 'US',
      }),
    ).toBe('en');
  });

  it('preserves exact referral URL and rejects foreign URLs across all content languages', () => {
    const offer = makeOffer('US');
    const basePack = buildSimulatedAffiliateCampaignPack(offer, 30, 'es');
    const normalized = normalizeAndValidateCampaignPack(basePack, {
      expectedReferralUrl: offer.referralUrl,
      officialWebsiteUrl: offer.officialWebsiteUrl,
      vertical: offer.vertical,
      targetMarket: offer.targetMarket,
      locale: 'es',
    });
    expect(normalized.referralUrl).toBe(offer.referralUrl);
    expect(normalized.contentLanguage).toBe('es');

    expect(() =>
      normalizeAndValidateCampaignPack(
        { ...basePack, socialPost: 'Check https://evil-competitor.example.net/steal' },
        {
          expectedReferralUrl: offer.referralUrl,
          officialWebsiteUrl: offer.officialWebsiteUrl,
          vertical: offer.vertical,
          targetMarket: offer.targetMarket,
          locale: 'es',
        },
      ),
    ).toThrow(/unauthorized third-party URL/i);
  });
});
