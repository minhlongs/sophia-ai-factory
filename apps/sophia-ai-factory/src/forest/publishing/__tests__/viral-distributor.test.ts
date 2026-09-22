import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildFunnelTrackingUrl,
  buildTelegramDeepLink,
  formatPlatformCaption,
  publishSinglePlatform,
  publishToViralPlatforms,
} from '../viral-distributor';
import type { ViralPublishInput } from '@/seed/types/growth';

describe('Viral Video Distributor (Forest Layer)', () => {
  const sampleInput: ViralPublishInput = {
    videoId: 'vid_test_888',
    videoTitle: 'How to scale to $5,000 MRR without employees',
    videoUrl: 'https://storage.agencyos.network/videos/vid_test_888.mp4',
    niche: 'solopreneur',
    hookArchetype: 'contrarian',
    scriptText: 'You don’t need a team of 10 to make $100K. You need 1 person and 5 AI agents.',
    platforms: ['tiktok', 'youtube_shorts', 'twitter'],
    referralCode: 'TOP_PARTNER',
  };

  describe('buildFunnelTrackingUrl', () => {
    it('injects all standard UTM tracking parameters', () => {
      const urlString = buildFunnelTrackingUrl({
        platform: 'tiktok',
        niche: 'ai_automation',
        hookArchetype: 'curiosity_gap',
        videoId: 'vid_101',
        referralCode: 'PARTNER_A',
      });

      const url = new URL(urlString);
      expect(url.origin).toBe('https://sophia.agencyos.network');
      expect(url.searchParams.get('utm_source')).toBe('tiktok');
      expect(url.searchParams.get('utm_medium')).toBe('short_video');
      expect(url.searchParams.get('utm_campaign')).toBe('ai_automation');
      expect(url.searchParams.get('utm_content')).toBe('curiosity_gap_vid_101');
      expect(url.searchParams.get('ref')).toBe('PARTNER_A');
    });

    it('maps platform "x" to utm_source "twitter"', () => {
      const urlString = buildFunnelTrackingUrl({
        platform: 'x',
        niche: 'ecommerce',
        hookArchetype: 'problem_solution',
        videoId: 'vid_202',
      });

      const url = new URL(urlString);
      expect(url.searchParams.get('utm_source')).toBe('twitter');
    });
  });

  describe('buildTelegramDeepLink', () => {
    it('creates Telegram qualification deep link with video and platform payload', () => {
      const link = buildTelegramDeepLink({
        videoId: 'vid_303',
        platform: 'youtube_shorts',
        niche: 'ecommerce',
      });

      expect(link).toContain('https://t.me/Sophia_Bbot?start=');
      expect(link).toContain('vid_303_yt_ecommerce');
    });

    it('incorporates referral partner code into deep link payload', () => {
      const link = buildTelegramDeepLink({
        videoId: 'vid_303',
        platform: 'tiktok',
        niche: 'solopreneur',
        referralCode: 'REF42',
      });

      expect(link).toContain('vid_303_tt_ref_REF42');
    });

    it('respects custom start parameter when provided', () => {
      const link = buildTelegramDeepLink({
        videoId: 'vid_303',
        platform: 'twitter',
        niche: 'solopreneur',
        customStart: 'special_promo_solo100',
      });

      expect(link).toBe('https://t.me/Sophia_Bbot?start=special_promo_solo100');
    });
  });

  describe('formatPlatformCaption', () => {
    it('formats TikTok caption with link in bio CTA and hashtags', () => {
      const formatted = formatPlatformCaption('tiktok', {
        videoTitle: sampleInput.videoTitle,
        scriptText: sampleInput.scriptText,
        niche: 'solopreneur',
        hookArchetype: 'contrarian',
        videoId: sampleInput.videoId,
        referralCode: sampleInput.referralCode,
      });

      expect(formatted.caption).toContain('👉 Test our 24/7 autonomous video agent');
      expect(formatted.caption).toContain('💬 Telegram Demo:');
      expect(formatted.caption).toContain('#Solopreneur');
      expect(formatted.caption).toContain('#FYP');
      expect(formatted.trackedUrl).toContain('utm_source=tiktok');
      expect(formatted.telegramDeepLink).toContain('https://t.me/Sophia_Bbot');
    });

    it('formats YouTube Shorts caption with #Shorts tag and full funnel links', () => {
      const formatted = formatPlatformCaption('youtube_shorts', {
        videoTitle: sampleInput.videoTitle,
        scriptText: sampleInput.scriptText,
        niche: 'ai_automation',
        hookArchetype: 'shock_stat',
        videoId: sampleInput.videoId,
      });

      expect(formatted.caption).toContain('#Shorts');
      expect(formatted.caption).toContain('🚀 Deploy Your Autonomous Video AI:');
      expect(formatted.caption).toContain('SOLO100');
      expect(formatted.caption).toContain('#AIAutomation');
    });

    it('formats Twitter / X caption with concise high-converting copy', () => {
      const formatted = formatPlatformCaption('twitter', {
        videoTitle: sampleInput.videoTitle,
        niche: 'ecommerce',
        hookArchetype: 'direct_question',
        videoId: sampleInput.videoId,
      });

      expect(formatted.caption.length).toBeLessThanOrEqual(280);
      expect(formatted.caption).toContain('Automate 100% of your short-form funnel:');
      expect(formatted.trackedUrl).toContain('utm_source=twitter');
    });
  });

  describe('publishSinglePlatform and publishToViralPlatforms', () => {
    it('simulates publishing across TikTok, YouTube Shorts, and X successfully', async () => {
      const result = await publishToViralPlatforms(sampleInput);

      expect(result.videoId).toBe('vid_test_888');
      expect(result.success).toBe(true);
      expect(result.publishedCount).toBe(3);
      expect(result.failedCount).toBe(0);

      expect(result.results.tiktok?.status).toBe('published');
      expect(result.results.tiktok?.postUrl).toContain('tiktok.com');

      expect(result.results.youtube_shorts?.status).toBe('published');
      expect(result.results.youtube_shorts?.postUrl).toContain('youtube.com/shorts');

      expect(result.results.twitter?.status).toBe('published');
      expect(result.results.twitter?.postUrl).toContain('x.com');
    });

    it('marks result as scheduled when scheduledAt is in the future', async () => {
      const futureTime = Date.now() + 86400000;
      const scheduledResult = await publishSinglePlatform('youtube_shorts', {
        ...sampleInput,
        scheduledAt: futureTime,
      });

      expect(scheduledResult.status).toBe('scheduled');
      expect(scheduledResult.platform).toBe('youtube_shorts');
    });
  });
});
