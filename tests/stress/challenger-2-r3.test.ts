import { describe, it, expect } from 'vitest';
import {
  parseAcceptLanguage,
  resolveApacLocale,
  getCountryDefaultLocale,
  formatLocalizedPath,
  isApacLocale,
} from '@/tree/localization/geo-router';
import {
  generateViralMetadata,
  formatSeoDescription,
  buildTrackedFunnelUrl,
  buildTelegramDeepLink,
  PLATFORM_LIMITS,
} from '@/tree/publishing/viral-metadata-generator';

describe('Adversarial Challenger 2 (Iteration 3) Empirical Test Suite', () => {
  describe('1. Geo-Router Empirical Verification', () => {
    it('specifically verifies resolveApacLocale("JP", "q=0.9;ja, th;;q=") returns "ja", NOT "th"', () => {
      const resolved = resolveApacLocale('JP', 'q=0.9;ja, th;;q=');
      expect(resolved).toBe('ja');
      expect(resolved).not.toBe('th');
    });

    it('verifies resolveApacLocale("JP", "de-DE;q=1.0, th-TH;q=0.1") returns "ja"', () => {
      const resolved = resolveApacLocale('JP', 'de-DE;q=1.0, th-TH;q=0.1');
      expect(resolved).toBe('ja');
    });

    it('verifies resolveApacLocale("JP", "de-DE;q=1.0, th-TH;q=0.95") returns "th"', () => {
      const resolved = resolveApacLocale('JP', 'de-DE;q=1.0, th-TH;q=0.95');
      expect(resolved).toBe('th');
    });

    it('handles empty, null, undefined, and whitespace headers', () => {
      expect(resolveApacLocale('JP', '')).toBe('ja');
      expect(resolveApacLocale('JP', null)).toBe('ja');
      expect(resolveApacLocale('KR', undefined)).toBe('ko');
      expect(resolveApacLocale('TH', '   ')).toBe('th');
      expect(resolveApacLocale('VN', '')).toBe('vi');
    });

    it('handles inverted q-weights correctly', () => {
      // In SG (default 'en'), th-TH has 0.2, ja-JP has 0.85 -> ja should be selected
      expect(resolveApacLocale('SG', 'th-TH;q=0.2, ja-JP;q=0.85')).toBe('ja');
      // In SG, ko has 0.1, vi has 0.7 -> vi should be selected
      expect(resolveApacLocale('SG', 'ko-KR;q=0.1, vi-VN;q=0.7')).toBe('vi');
    });

    it('handles multi-language with non-APAC languages interspersed', () => {
      // zh-CN (non-APAC), es-ES (non-APAC), de (non-APAC), ko-KR (q=0.4 < 0.9) in TH -> th
      expect(resolveApacLocale('TH', 'zh-CN;q=1.0, es-ES;q=0.9, de;q=0.8, ko-KR;q=0.4')).toBe('th');
      // Korean at tail with q=0.95 >= 0.9 -> ko
      expect(resolveApacLocale('TH', 'zh-CN;q=1.0, es-ES;q=0.9, de;q=0.8, ko-KR;q=0.95')).toBe('ko');
    });

    it('handles malformed, corrupted, and unusual tokens without throwing', () => {
      expect(resolveApacLocale('JP', ';;;;q=invalid, %%%, ???, ===')).toBe('ja');
      expect(resolveApacLocale('JP', 'invalid-tag, %%%;q=999, th-TH;q=0.5')).toBe('ja');
      expect(resolveApacLocale('VN', 'vi-VN;q=1.5, en-US;q=-0.5')).toBe('vi');
      expect(resolveApacLocale(null, 'fr-FR,de-DE')).toBe('en');
    });
  });

  describe('2. Viral Metadata Description Truncation & Link Preservation Under Stress', () => {
    const platforms = ['tiktok', 'instagram_reels', 'facebook_reels', 'youtube_shorts'] as const;

    platforms.forEach((platform) => {
      const maxLen = PLATFORM_LIMITS[platform].maxDescriptionLength;

      it(`guarantees 100% preservation of trackedFunnelUrl and telegramDeepLink on ${platform} (max ${maxLen}) under 10k payload`, () => {
        const massiveTopic = 'Autonomous AI Factory Scaling & Omnichannel Dubbing Masterclass '.repeat(200); // ~13,000 chars
        const massiveTakeaways = Array.from({ length: 40 }, (_, i) => `Takeaway #${i + 1}: Automated high-throughput syndication reduces overhead`);

        const result = generateViralMetadata({
          topic: massiveTopic,
          niche: 'ai_automation',
          targetPlatform: platform,
          targetLanguage: 'en',
          targetMarket: 'tokyo',
          keyTakeaways: massiveTakeaways,
          referralCode: `REF_${platform.toUpperCase()}_STRESS`,
        });

        // 1. Strict length limit
        expect(result.seoDescription.length).toBeLessThanOrEqual(maxLen);
        expect(result.charCount.description).toBe(result.seoDescription.length);
        expect(result.isCompliant).toBe(true);

        // 2. Both links 100% preserved
        expect(result.seoDescription).toContain(result.trackedFunnelUrl);
        expect(result.seoDescription).toContain(result.telegramDeepLink);

        // 3. Link validity
        expect(result.trackedFunnelUrl).toContain(`utm_source=${platform}`);
        expect(result.trackedFunnelUrl).toContain(`ref=REF_${platform.toUpperCase()}_STRESS`);
        expect(result.telegramDeepLink).toContain('Sophia_Bbot');
      });
    });

    it('survives an extreme 30,000-character payload on TikTok with isCompliant === true', () => {
      const ultraPayload = 'Extreme Stress Test Payload '.repeat(1000); // 28,000 chars
      const result = generateViralMetadata({
        topic: ultraPayload,
        niche: 'solopreneur',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
      });

      expect(result.seoDescription.length).toBeLessThanOrEqual(2200);
      expect(result.isCompliant).toBe(true);
      expect(result.seoDescription).toContain(result.trackedFunnelUrl);
      expect(result.seoDescription).toContain(result.telegramDeepLink);
    });

    it('survives when attribution block itself is close to limit', () => {
      const hugeFunnelUrl = 'https://sophia.agencyos.network/' + 'a'.repeat(800);
      const hugeTgLink = 'https://t.me/Sophia_Bbot?start=' + 'b'.repeat(800);

      const formatted = formatSeoDescription({
        platform: 'tiktok',
        language: 'en',
        rawTitle: 'A'.repeat(500),
        trackedFunnelUrl: hugeFunnelUrl,
        telegramDeepLink: hugeTgLink,
        hashtags: ['#Test1', '#Test2'],
        maxDescriptionLength: 2200,
      });

      expect(formatted.length).toBeLessThanOrEqual(2200);
      expect(formatted).toContain(hugeFunnelUrl);
      expect(formatted).toContain(hugeTgLink);
    });
  });
});
