import { describe, it, expect } from 'vitest';
import {
  buildTelegramDeepLink,
  buildTrackedFunnelUrl,
  formatSeoDescription,
  generateThumbnailPromptSpec,
  generateViralMetadata,
  PLATFORM_LIMITS,
} from '../viral-metadata-generator';
import type { ApacLanguage, PlatformType } from '@/seed/types/apac-syndication';

describe('Unified Viral Metadata Generator', () => {
  describe('Platform Constraints & Limits', () => {
    it('defines limits conforming to platform upload specifications', () => {
      expect(PLATFORM_LIMITS.youtube_shorts.maxTitleLength).toBe(100);
      expect(PLATFORM_LIMITS.youtube_shorts.maxDescriptionLength).toBe(5000);

      expect(PLATFORM_LIMITS.tiktok.maxTitleLength).toBe(150);
      expect(PLATFORM_LIMITS.tiktok.maxDescriptionLength).toBe(2200);

      expect(PLATFORM_LIMITS.instagram_reels.maxTitleLength).toBe(150);
      expect(PLATFORM_LIMITS.instagram_reels.maxDescriptionLength).toBe(2200);

      expect(PLATFORM_LIMITS.facebook_reels.maxTitleLength).toBe(150);
      expect(PLATFORM_LIMITS.facebook_reels.maxDescriptionLength).toBe(2200);
    });
  });

  describe('Multilingual Psychological Hook Generation', () => {
    const topic = 'ChatGPT Video Automation';

    it('generates psychological hooks in Vietnamese (VI)', () => {
      const res = generateViralMetadata({
        topic,
        niche: 'ai_automation',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
        hookArchetype: 'curiosity_gap',
      });

      expect(res.hookTitle).toContain('Bí Mật Đằng Sau ChatGPT Video Automation');
      expect(res.language).toBe('vi');
      expect(res.isCompliant).toBe(true);
    });

    it('generates psychological hooks in English (EN)', () => {
      const res = generateViralMetadata({
        topic,
        niche: 'ai_automation',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'en',
        hookArchetype: 'shock_stat',
      });

      expect(res.hookTitle).toContain('93% Fail At ChatGPT Video Automation');
      expect(res.hookTitle).toContain('#Shorts');
      expect(res.hookTitle.length).toBeLessThanOrEqual(100);
    });

    it('generates psychological hooks in Japanese (JA)', () => {
      const res = generateViralMetadata({
        topic,
        niche: 'ai_automation',
        targetPlatform: 'instagram_reels',
        targetLanguage: 'ja',
        hookArchetype: 'curiosity_gap',
      });

      expect(res.hookTitle).toContain('99%が知らない【ChatGPT Video Automation】');
      expect(res.language).toBe('ja');
      expect(res.hashtags).toContain('#AIツール');
    });

    it('generates psychological hooks in Korean (KO)', () => {
      const res = generateViralMetadata({
        topic,
        niche: 'ai_automation',
        targetPlatform: 'facebook_reels',
        targetLanguage: 'ko',
        hookArchetype: 'problem_solution',
      });

      expect(res.hookTitle).toContain('단 5분 만에 끝내는 ChatGPT Video Automation');
      expect(res.language).toBe('ko');
      expect(res.hashtags).toContain('#AI자동화');
    });

    it('generates psychological hooks in Thai (TH)', () => {
      const res = generateViralMetadata({
        topic,
        niche: 'ai_automation',
        targetPlatform: 'tiktok',
        targetLanguage: 'th',
        hookArchetype: 'contrarian',
      });

      expect(res.hookTitle).toContain('หยุดทำ ChatGPT Video Automation แบบเดิมๆ');
      expect(res.language).toBe('th');
      expect(res.hashtags).toContain('#ปัญญาประดิษฐ์');
    });
  });

  describe('Platform-Specific Formatting & Title Strictness', () => {
    it('enforces YouTube Shorts title <= 100 chars and appends #Shorts', () => {
      const veryLongTopic = 'Super Extra Long Topic That Will Definitely Exceed Normal Limits When Combined With Hook Archetype Copy Text For AI Agents';
      const res = generateViralMetadata({
        topic: veryLongTopic,
        niche: 'ai_automation',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'en',
        hookArchetype: 'curiosity_gap',
      });

      expect(res.hookTitle.length).toBeLessThanOrEqual(100);
      expect(res.hookTitle).toContain('#Shorts');
      expect(res.isCompliant).toBe(true);
    });

    it('formats TikTok caption with emojis and link in bio callout', () => {
      const res = generateViralMetadata({
        topic: 'AI E-Commerce',
        niche: 'ecommerce',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
      });

      expect(res.seoDescription).toContain('Link in bio');
      expect(res.seoDescription).toContain('Telegram');
      expect(res.hashtags).toContain('#FYP');
    });

    it('formats Instagram Reels description with clean spacing and hashtags', () => {
      const res = generateViralMetadata({
        topic: 'AI Solopreneur',
        niche: 'solopreneur',
        targetPlatform: 'instagram_reels',
        targetLanguage: 'en',
      });

      expect(res.seoDescription).toContain('✨');
      expect(res.seoDescription).toContain('🔗');
      expect(res.hashtags).toContain('#ReelsInstagram');
      expect(res.hashtags).toContain('#Solopreneur');
    });

    it('formats Facebook Reels description with engagement CTA', () => {
      const res = generateViralMetadata({
        topic: 'Tự Động Hóa Bán Hàng',
        niche: 'ecommerce',
        targetPlatform: 'facebook_reels',
        targetLanguage: 'vi',
      });

      expect(res.seoDescription).toContain('🔥');
      expect(res.seoDescription).toContain('Bình luận');
      expect(res.hashtags).toContain('#FBReels');
    });
  });

  describe('Tracking Links & Deep Links', () => {
    it('constructs tracked funnel URL with correct UTM parameters', () => {
      const url = buildTrackedFunnelUrl({
        baseUrl: 'https://sophia.agencyos.network',
        platform: 'youtube_shorts',
        niche: 'ai_automation',
        hookArchetype: 'curiosity_gap',
        videoId: 'vid_test123',
        referralCode: 'TOPCREATOR',
      });

      expect(url).toContain('utm_source=youtube_shorts');
      expect(url).toContain('utm_medium=short_video');
      expect(url).toContain('utm_campaign=ai_automation');
      expect(url).toContain('utm_content=curiosity_gap_vid_test123');
      expect(url).toContain('ref=TOPCREATOR');
    });

    it('constructs Telegram bot deep link within 64 character payload constraint', () => {
      const link = buildTelegramDeepLink({
        botUsername: 'Sophia_Bbot',
        videoId: 'vid_9876543210abcdef',
        platform: 'tiktok',
        niche: 'ecommerce',
        referralCode: 'AFF999',
      });

      expect(link).toContain('https://t.me/Sophia_Bbot?start=');
      const startParam = new URL(link).searchParams.get('start');
      expect(startParam).toBeDefined();
      expect(startParam!.length).toBeLessThanOrEqual(64);
      expect(startParam).toMatch(/^[a-zA-Z0-9_]+$/);
    });

    it('supports custom Telegram start parameter', () => {
      const link = buildTelegramDeepLink({
        botUsername: 'Sophia_Bbot',
        videoId: 'vid_123',
        platform: 'youtube_shorts',
        niche: 'ai_automation',
        customStart: 'campaign_apac_launch',
      });

      expect(link).toBe('https://t.me/Sophia_Bbot?start=campaign_apac_launch');
    });
  });

  describe('CTR Thumbnail Prompt Specification', () => {
    it('generates 9:16 mobile CTR optimized thumbnail prompt specification', () => {
      const spec = generateThumbnailPromptSpec({
        topic: 'AI Automation In 2026',
        language: 'vi',
        platform: 'youtube_shorts',
        hookHeadline: 'Bí Mật Đằng Sau Tự Động Hóa AI',
      });

      expect(spec.aspectRatio).toBe('9:16');
      expect(spec.headlineText).toContain('Bí Mật Đằng Sau');
      expect(spec.prompt).toContain('9:16 mobile thumbnail');
      expect(spec.prompt).toContain('Focal Point:');
      expect(spec.prompt).toContain('Typography & Layout:');
      expect(spec.prompt).toContain('Color & Lighting:');
      expect(spec.colorPalette.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Comprehensive Metadata Pipeline', () => {
    it('runs end-to-end for all 4 platforms and 5 languages', () => {
      const platforms: PlatformType[] = [
        'youtube_shorts',
        'tiktok',
        'instagram_reels',
        'facebook_reels',
      ];
      const languages: ApacLanguage[] = ['vi', 'en', 'ja', 'ko', 'th'];

      for (const p of platforms) {
        for (const l of languages) {
          const result = generateViralMetadata({
            topic: 'Autonomous AI Factory',
            niche: 'ai_automation',
            targetPlatform: p,
            targetLanguage: l,
            targetMarket: 'hanoi',
            keyTakeaways: ['10x speed', 'Zero effort', 'High ROI'],
            referralCode: 'TEST2026',
          });

          expect(result.platform).toBe(p);
          expect(result.language).toBe(l);
          expect(result.hookTitle.length).toBeGreaterThan(0);
          expect(result.seoDescription.length).toBeGreaterThan(0);
          expect(result.hashtags.length).toBeGreaterThan(0);
          expect(result.thumbnailPrompt.length).toBeGreaterThan(0);
          expect(result.trackedFunnelUrl).toContain('utm_source=');
          expect(result.telegramDeepLink).toContain('https://t.me/');
          expect(result.isCompliant).toBe(true);
        }
      }
    });
  });

  describe('Viral Metadata Truncation & Attribution Preservation', () => {
    it('preserves trackedFunnelUrl and telegramDeepLink when TikTok description exceeds 2200 chars', () => {
      const massiveTopic = 'Viral Automation Masterclass '.repeat(100); // ~3000 chars
      const result = generateViralMetadata({
        topic: massiveTopic,
        niche: 'ai_automation',
        targetPlatform: 'tiktok',
        targetLanguage: 'en',
        targetMarket: 'singapore',
      });

      expect(result.seoDescription.length).toBeLessThanOrEqual(2200);
      expect(result.isCompliant).toBe(true);
      expect(result.seoDescription).toContain(result.trackedFunnelUrl);
      expect(result.seoDescription).toContain(result.telegramDeepLink);
      expect(result.seoDescription).toContain('...');
      expect(result.charCount.description).toBe(result.seoDescription.length);
    });

    it('preserves trackedFunnelUrl and telegramDeepLink when YouTube Shorts description exceeds 5000 chars', () => {
      const massiveTopic = 'Ultimate YouTube Shorts AI Automation Blueprint '.repeat(150); // ~7200 chars
      const result = generateViralMetadata({
        topic: massiveTopic,
        niche: 'ai_automation',
        targetPlatform: 'youtube_shorts',
        targetLanguage: 'vi',
        targetMarket: 'hanoi',
        keyTakeaways: ['Tự động hóa 100%', 'Tối ưu hóa doanh thu', 'Chi phí thấp'],
        referralCode: 'YOUTUBE2026',
      });

      expect(result.seoDescription.length).toBeLessThanOrEqual(5000);
      expect(result.isCompliant).toBe(true);
      expect(result.seoDescription).toContain(result.trackedFunnelUrl);
      expect(result.seoDescription).toContain(result.telegramDeepLink);
      expect(result.seoDescription).toContain('...');
      expect(result.seoDescription).toContain('YOUTUBE2026');
    });

    it('preserves attribution block with massive keyTakeaways list on Instagram and Facebook Reels', () => {
      const massiveTakeaways = Array.from(
        { length: 80 },
        (_, i) => `Key strategy point number ${i + 1} detailing advanced AI workflows and high-speed pipelines`,
      );
      for (const platform of ['instagram_reels', 'facebook_reels'] as const) {
        const result = generateViralMetadata({
          topic: 'Massive Video Syndication',
          niche: 'solopreneur',
          targetPlatform: platform,
          targetLanguage: 'vi',
          keyTakeaways: massiveTakeaways,
        });

        expect(result.seoDescription.length).toBeLessThanOrEqual(2200);
        expect(result.isCompliant).toBe(true);
        expect(result.seoDescription).toContain(result.trackedFunnelUrl);
        expect(result.seoDescription).toContain(result.telegramDeepLink);
        expect(result.seoDescription).toContain('...');
      }
    });

    it('directly tests formatSeoDescription with body truncation and intact attribution footer', () => {
      const formatted = formatSeoDescription({
        platform: 'tiktok',
        language: 'en',
        rawTitle: 'A'.repeat(3000),
        trackedFunnelUrl: 'https://sophia.agencyos.network/funnel?utm_source=tiktok&vid=123',
        telegramDeepLink: 'https://t.me/Sophia_Bbot?start=v_123_tt',
        hashtags: ['#FYP', '#ViralVideo'],
        maxDescriptionLength: 1000,
      });

      expect(formatted.length).toBeLessThanOrEqual(1000);
      expect(formatted).toContain('https://sophia.agencyos.network/funnel?utm_source=tiktok&vid=123');
      expect(formatted).toContain('https://t.me/Sophia_Bbot?start=v_123_tt');
      expect(formatted).toContain('...');
      expect(formatted).toContain('#FYP #ViralVideo');
    });

    it('preserves trackedFunnelUrl and telegramDeepLink even when maxDescriptionLength is extremely tight', () => {
      const funnelUrl = 'https://sophia.agencyos.network/utm_test_url';
      const tgLink = 'https://t.me/Sophia_Bbot?start=mini';
      const formatted = formatSeoDescription({
        platform: 'tiktok',
        language: 'vi',
        rawTitle: 'Long title that cannot fit at all',
        trackedFunnelUrl: funnelUrl,
        telegramDeepLink: tgLink,
        hashtags: ['#tag1', '#tag2', '#tag3', '#tag4', '#tag5'],
        maxDescriptionLength: 200,
      });

      expect(formatted).toContain(funnelUrl);
      expect(formatted).toContain(tgLink);
    });

    it('preserves full description unmodified when content is within maxDescriptionLength', () => {
      const result = generateViralMetadata({
        topic: 'Short Topic',
        niche: 'ecommerce',
        targetPlatform: 'tiktok',
        targetLanguage: 'vi',
      });

      expect(result.seoDescription).not.toContain('...');
      expect(result.seoDescription).toContain(result.trackedFunnelUrl);
      expect(result.seoDescription).toContain(result.telegramDeepLink);
      expect(result.isCompliant).toBe(true);
    });
  });
});

