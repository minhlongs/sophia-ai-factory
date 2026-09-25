/**
 * M5 Challenger 2: Empirical Adversarial Stress Test Suite
 *
 * Systematically challenges and stress-tests:
 * 1. Subtitle Formatter & Edge TTS synchronization:
 *    - Inverted timestamps (start > end), zero duration, extreme durations (4h/100h), malformed strings.
 *    - Format conversion round-trips: SRT -> VTT -> SRT verifying lossless cue preservation.
 * 2. Smart Geo-Router:
 *    - Malformed Accept-Language headers, missing quality weights, international roaming proxies.
 *    - Cross-language quality weight hijacking vulnerability.
 * 3. Omnichannel Syndication & Character Budgets:
 *    - Strict character limit truncation (YouTube Shorts 100, TikTok 2200) and UTM link preservation.
 *    - Telegram 64-char start payload compliance.
 * 4. Adaptive HLS Manifest Generator:
 *    - Single-variant fallback, missing audio groups, bandwidth ladder ordering, RFC 8216 compliance.
 *
 * @module __tests__/adversarial/m5-challenger-2-stress.test
 */

import { describe, it, expect } from 'vitest';

// 1. Subtitle Formatter Imports
import {
  formatSrtTimestamp,
  formatVttTimestamp,
  parseTimestamp,
  normalizeSegments,
  wordsToSegments,
  segmentsToSrt,
  segmentsToVtt,
  parseSrt,
  parseVtt,
  convertSubtitleFormat,
} from '@/tree/subtitles/subtitle-formatter';
import type { SubtitleSegment, TranscriptWord } from '@/seed/types/dubbing';

// 2. Smart Geo-Router Imports
import {
  parseAcceptLanguage,
  getCountryDefaultLocale,
  resolveApacLocale,
  formatLocalizedPath,
  isApacLocale,
  COUNTRY_TO_LOCALE_MAP,
} from '@/tree/localization/geo-router';

// 3. Omnichannel Syndication Imports
import {
  generateViralMetadata,
  buildTrackedFunnelUrl,
  buildTelegramDeepLink,
  PLATFORM_LIMITS,
} from '@/tree/publishing/viral-metadata-generator';
import { formatPlatformCaption } from '@/forest/publishing/viral-distributor';

// 4. Adaptive HLS Manifest Generator Imports
import {
  generateMasterManifest,
  generateMediaPlaylist,
  createHlsMasterManifestData,
  buildDefaultVariants,
} from '@/forest/streaming/hls-manifest-generator';
import type { HlsAudioTrack, HlsSubtitleTrack, HlsVariantStream } from '@/seed/types/streaming';

describe('M5 Challenger 2: Empirical Stress Test Suite', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 1: Subtitle Formatter & Edge TTS Synchronization
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Domain 1: Subtitle Formatter & Edge TTS Synchronization', () => {

    describe('1.1 Timestamp Parsing & Formatting Extremes', () => {
      it('correctly formats and parses extreme duration: 4 hours (14,400s)', () => {
        const seconds = 14400; // 4 hours
        const srtTime = formatSrtTimestamp(seconds);
        const vttTime = formatVttTimestamp(seconds);

        expect(srtTime).toBe('04:00:00,000');
        expect(vttTime).toBe('04:00:00.000');

        expect(parseTimestamp(srtTime)).toBe(14400);
        expect(parseTimestamp(vttTime)).toBe(14400);
      });

      it('correctly formats and parses extreme duration: 100 hours (360,000s) and 150 hours (540,000s)', () => {
        const seconds = 360000; // 100 hours
        const srtTime = formatSrtTimestamp(seconds);
        expect(srtTime).toBe('100:00:00,000');
        expect(parseTimestamp(srtTime)).toBe(360000);

        const extremeSeconds = 540000; // 150 hours
        const srt150 = formatSrtTimestamp(extremeSeconds);
        const vtt150 = formatVttTimestamp(extremeSeconds);
        expect(srt150).toBe('150:00:00,000');
        expect(vtt150).toBe('150:00:00.000');
        expect(parseTimestamp(srt150)).toBe(540000);
        expect(parseTimestamp(vtt150)).toBe(540000);
      });

      it('correctly formats and parses zero duration (0ms) and millisecond precision', () => {
        expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
        expect(formatVttTimestamp(0)).toBe('00:00:00.000');
        expect(parseTimestamp('00:00:00,000')).toBe(0);
        expect(parseTimestamp('00:00:00.000')).toBe(0);

        // Millisecond precision (0.001s and rounding)
        expect(formatSrtTimestamp(0.001)).toBe('00:00:00,001');
        expect(formatVttTimestamp(0.001)).toBe('00:00:00.001');
        expect(parseTimestamp('00:00:00,001')).toBe(0.001);

        // Sub-millisecond rounding to nearest millisecond
        expect(formatSrtTimestamp(12.3456)).toBe('00:00:12,346');
        expect(formatVttTimestamp(12.3456)).toBe('00:00:12.346');
        expect(parseTimestamp('00:00:12,346')).toBe(12.346);
        expect(parseTimestamp('00:00:12.346')).toBe(12.346);
      });

      it('handles negative timestamps and non-finite values safely', () => {
        expect(formatSrtTimestamp(-15.5)).toBe('00:00:00,000');
        expect(formatVttTimestamp(NaN)).toBe('00:00:00.000');
        expect(formatSrtTimestamp(Infinity)).toBe('00:00:00,000');
        expect(formatVttTimestamp(-Infinity)).toBe('00:00:00.000');

        expect(parseTimestamp('')).toBe(0);
        expect(parseTimestamp('invalid:time:stamp')).toBe(0);
        expect(parseTimestamp('::')).toBe(0);
      });

      it('parses timestamps with 2 parts (MM:SS) and 3 parts (HH:MM:SS)', () => {
        expect(parseTimestamp('01:30.500')).toBe(90.5);
        expect(parseTimestamp('01:30,500')).toBe(90.5);
        expect(parseTimestamp('02:15:30.250')).toBe(2 * 3600 + 15 * 60 + 30.25);
      });
    });

    describe('1.2 Inverted & Zero-Duration Timestamps Normalization', () => {
      it('enforces minimum cue duration when end <= start (inverted or zero duration)', () => {
        const segments: SubtitleSegment[] = [
          { id: 1, start: 10.0, end: 5.0, text: 'Inverted cue' },
          { id: 2, start: 20.0, end: 20.0, text: 'Zero duration cue' },
        ];

        const normalized = normalizeSegments(segments, 0.8);
        expect(normalized).toHaveLength(2);

        // First cue: end was 5 <= 10 -> corrected to 10 + 0.8 = 10.8
        expect(normalized[0].start).toBe(10.0);
        expect(normalized[0].end).toBe(10.8);

        // Second cue: end was 20 <= 20 -> corrected to 20 + 0.8 = 20.8
        expect(normalized[1].start).toBe(20.0);
        expect(normalized[1].end).toBe(20.8);
      });

      it('sorts chronologically inverted segment orders', () => {
        const segments: SubtitleSegment[] = [
          { id: 1, start: 30.0, end: 35.0, text: 'Third' },
          { id: 2, start: 5.0, end: 10.0, text: 'First' },
          { id: 3, start: 15.0, end: 20.0, text: 'Second' },
        ];

        const normalized = normalizeSegments(segments);
        expect(normalized.map((s) => s.text)).toEqual(['First', 'Second', 'Third']);
        expect(normalized.map((s) => s.id)).toEqual([1, 2, 3]);
      });

      it('drops empty or whitespace-only subtitle text during normalization', () => {
        const segments: SubtitleSegment[] = [
          { id: 1, start: 1.0, end: 2.0, text: '   ' },
          { id: 2, start: 3.0, end: 4.0, text: 'Valid text' },
          { id: 3, start: 5.0, end: 6.0, text: '' },
        ];

        const normalized = normalizeSegments(segments);
        expect(normalized).toHaveLength(1);
        expect(normalized[0].text).toBe('Valid text');
      });
    });

    describe('1.3 SRT / VTT Conversion Round-Trip & Lossless Preservation', () => {
      it('executes lossless round-trip SRT -> VTT -> SRT for clean single-line cues', () => {
        const originalSrt = [
          '1',
          '00:00:01,000 --> 00:00:04,500',
          'Hello world, this is a dubbing test.',
          '',
          '2',
          '00:00:05,000 --> 00:00:08,250',
          'Sophia AI Factory multi-language pipeline.',
        ].join('\n');

        const vtt = convertSubtitleFormat(originalSrt, 'srt', 'vtt');
        expect(vtt).toContain('WEBVTT');
        expect(vtt).toContain('00:00:01.000 --> 00:00:04.500');
        expect(vtt).toContain('Hello world, this is a dubbing test.');

        const roundTripSrt = convertSubtitleFormat(vtt, 'vtt', 'srt');
        expect(roundTripSrt.trim()).toBe(originalSrt.trim());
      });

      it('documents empirical behavior: multi-line cues are collapsed to single-line in round-trip', () => {
        const multiLineSrt = [
          '1',
          '00:00:01,000 --> 00:00:04,000',
          'Line one',
          'Line two',
        ].join('\n');

        const vtt = convertSubtitleFormat(multiLineSrt, 'srt', 'vtt');
        // Observation: textLines.join(' ') collapses newlines
        expect(vtt).toContain('Line one Line two');
      });

      it('resiliently parses dirty SRT with missing index numbers and Windows CRLF', () => {
        const dirtySrt = '00:00:02,000 --> 00:00:05,000\r\nDirect cue without sequence number\r\n\r\n00:00:06,000 --> 00:00:09,000\r\nSecond cue';
        const parsed = parseSrt(dirtySrt);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].text).toBe('Direct cue without sequence number');
        expect(parsed[1].text).toBe('Second cue');
      });

      it('parses WebVTT with cue settings and comments/notes gracefully', () => {
        const vttWithNotes = [
          'WEBVTT - Dubbing Track',
          'NOTE Speaker 1 begins talking here',
          '',
          '1',
          '00:01.000 --> 00:04.000 line:0 position:20%',
          '<v Speaker1>Welcome to Tokyo!</v>',
        ].join('\n');

        const parsed = parseVtt(vttWithNotes);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].start).toBe(1.0);
        expect(parsed[0].end).toBe(4.0);
        expect(parsed[0].text).toBe('Welcome to Tokyo!'); // HTML voice tag stripped cleanly
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 2: Smart APAC Geo-Router Stress Tests
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Domain 2: Smart APAC Geo-Router Stress Tests', () => {

    describe('2.1 Malformed Accept-Language & Header Parsing', () => {
      it('handles empty, null, wildcard, and corrupted Accept-Language headers', () => {
        expect(parseAcceptLanguage(null)).toEqual([]);
        expect(parseAcceptLanguage(undefined)).toEqual([]);
        expect(parseAcceptLanguage('')).toEqual([]);
        expect(parseAcceptLanguage('*')).toEqual([]);
        expect(parseAcceptLanguage('*,en;q=0.5')).toHaveLength(1);
        expect(parseAcceptLanguage(';;;;q=invalid')).toEqual([]);
      });

      it('correctly penalizes out-of-range quality weights and sorts descending', () => {
        const header = 'vi-VN;q=0.7, ja-JP;q=0.95, en-US;q=0.8, ko-KR;q=1.5, th;q=-0.2';
        const parsed = parseAcceptLanguage(header);

        // ko-KR (q=1.5 > 1.0) and th (q=-0.2 < 0) are penalized with q = 0.0
        // Expected sort: 0.95 (ja), 0.8 (en), 0.7 (vi), 0.0 (ko, th)
        expect(parsed[0].primaryCode).toBe('ja');
        expect(parsed[0].q).toBe(0.95);
        expect(parsed.find((p) => p.primaryCode === 'ko')?.q).toBe(0.0);
        expect(parsed.find((p) => p.primaryCode === 'th')?.q).toBe(0.0);
      });
    });

    describe('2.2 International Roaming Proxies & Geo Resolution', () => {
      it('handles unknown or anonymous proxy geo country codes (A1, T1, XX)', () => {
        expect(getCountryDefaultLocale('A1')).toBeNull();
        expect(getCountryDefaultLocale('T1')).toBeNull();
        expect(getCountryDefaultLocale('XX')).toBeNull();
        expect(getCountryDefaultLocale(null)).toBeNull();

        // Roaming through anonymous proxy with Japanese Accept-Language
        const resolved = resolveApacLocale('A1', 'ja-JP,ja;q=0.9');
        expect(resolved).toBe('ja');
      });

      it('resolves primary APAC country markets without headers', () => {
        expect(resolveApacLocale('VN')).toBe('vi');
        expect(resolveApacLocale('JP')).toBe('ja');
        expect(resolveApacLocale('KR')).toBe('ko');
        expect(resolveApacLocale('TH')).toBe('th');
        expect(resolveApacLocale('SG')).toBe('en');
        expect(resolveApacLocale('US')).toBe('en');
      });

      it('allows strong explicit browser locale (q >= 0.9) to override international geo', () => {
        // Vietnamese traveler in Singapore (SG -> en default) with explicit vi preference
        const travelerLocale = resolveApacLocale('SG', 'vi-VN,vi;q=0.95,en;q=0.8');
        expect(travelerLocale).toBe('vi');
      });
    });

    describe('2.3 REMEDIATION VERIFICATION: Quality Weight Precedence & Cross-Language Isolation', () => {
      it('VERIFIES FIX: Non-APAC primary language q-weight does NOT leak into subsequent APAC locale (de-DE;q=1.0, th-TH;q=0.1 in JP -> ja)', () => {
        // SCENARIO: A German tourist visiting Japan.
        // User browser header: de-DE (q=1.0), th-TH (q=0.1 - faint Thai interest).
        // Geo location: JP (Japan).
        // VERIFIED: User is in Japan, does not have high preference (>= 0.9) for Thai, so correctly gets 'ja'.
        const result = resolveApacLocale('JP', 'de-DE;q=1.0, th-TH;q=0.1');
        expect(result).toBe('ja');
      });

      it('VERIFIES FIX: Explicit strong browser preference (q >= 0.9) overrides native market (de-DE;q=1.0, th-TH;q=0.95 in JP -> th)', () => {
        // SCENARIO: User in Japan with explicit strong Thai preference (q=0.95 >= 0.9).
        const result = resolveApacLocale('JP', 'de-DE;q=1.0, th-TH;q=0.95');
        expect(result).toBe('th');
      });

      it('VERIFIES FIX: French speaker in Vietnam with weak English gets Vietnamese (fr-FR;q=1.0, en-US;q=0.2 in VN -> vi)', () => {
        // SCENARIO: French speaker in Vietnam with Accept-Language: fr-FR;q=1.0, en-US;q=0.2.
        // Geo location: VN. English is only q=0.2, so Vietnam native geo correctly returns 'vi'.
        const result = resolveApacLocale('VN', 'fr-FR;q=1.0, en-US;q=0.2');
        expect(result).toBe('vi');
      });

      it('VERIFIES FIX: French speaker in Vietnam with strong English gets English (fr-FR;q=1.0, en-US;q=0.92 in VN -> en)', () => {
        // SCENARIO: Explicit strong English preference (q=0.92 >= 0.9) overrides Vietnam native geo.
        const result = resolveApacLocale('VN', 'fr-FR;q=1.0, en-US;q=0.92');
        expect(result).toBe('en');
      });

      it('stress tests malformed, inverted, empty, and multi-language Accept-Language headers against geo-router', () => {
        // Empty / undefined / null headers fall back to native geo
        expect(resolveApacLocale('JP', '')).toBe('ja');
        expect(resolveApacLocale('JP', null)).toBe('ja');
        expect(resolveApacLocale('KR', undefined)).toBe('ko');
        expect(resolveApacLocale('TH', '   ')).toBe('th');

        // Inverted q-weights: lower q comes first in string, parser must sort descending
        // th-TH has 0.2, ja-JP has 0.85 -> in SG (international), ja should be chosen over th
        expect(resolveApacLocale('SG', 'th-TH;q=0.2, ja-JP;q=0.85')).toBe('ja');

        // Multi-language with non-APAC languages interspersed:
        // zh-CN (non-APAC), es-ES (non-APAC), de (non-APAC), ko-KR (q=0.4 < 0.9)
        // In TH, Thai native market is preserved because Korean is < 0.9
        expect(resolveApacLocale('TH', 'zh-CN;q=1.0, es-ES;q=0.9, de;q=0.8, ko-KR;q=0.4')).toBe('th');

        // Multi-language with strong APAC language at tail:
        // Korean is at tail with q=0.95 -> overrides Thailand geo to 'ko'
        expect(resolveApacLocale('TH', 'zh-CN;q=1.0, es-ES;q=0.9, de;q=0.8, ko-KR;q=0.95')).toBe('ko');

        // Corrupted / malformed headers do not crash and handle gracefully
        expect(resolveApacLocale('JP', ';;;;q=invalid, %%%, ???, ===')).toBe('ja');
        // When q-value is empty or malformed (th;;q=), it defaults to 0.0, preserving native JP geo
        expect(resolveApacLocale('JP', 'q=0.9;ja, th;;q=')).toBe('ja');
        // With explicit weak q-value (th;q=0.5) alongside corrupted junk, JP native geo is preserved
        expect(resolveApacLocale('JP', 'invalid-tag, %%%;q=999, th-TH;q=0.5')).toBe('ja');
        expect(resolveApacLocale('VN', 'vi-VN;q=1.5, en-US;q=-0.5')).toBe('vi');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 3: Omnichannel Syndication & Character Budgets
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Domain 3: Omnichannel Syndication & Character Budgets', () => {

    describe('3.1 YouTube Shorts Title & Character Ceiling (100 Chars)', () => {
      it('strictly caps YouTube Shorts title at 100 characters while appending #Shorts', () => {
        const longTopic = 'Xây dựng cỗ máy bán hàng tự động 24/7 siêu lợi nhuận với trí tuệ nhân tạo và mô hình kinh doanh số đỉnh cao';
        const meta = generateViralMetadata({
          topic: longTopic,
          niche: 'ai_automation',
          targetPlatform: 'youtube_shorts',
          targetLanguage: 'vi',
          targetMarket: 'hanoi',
        });

        expect(meta.hookTitle.length).toBeLessThanOrEqual(100);
        expect(meta.hookTitle).toContain('#Shorts');
        expect(meta.charCount.title).toBe(meta.hookTitle.length);
      });

      it('preserves #Shorts tag even when topic exceeds 500 characters', () => {
        const hugeTopic = 'A'.repeat(500);
        const meta = generateViralMetadata({
          topic: hugeTopic,
          niche: 'ai_automation',
          targetPlatform: 'youtube_shorts',
          targetLanguage: 'en',
          targetMarket: 'tokyo',
        });

        expect(meta.hookTitle.length).toBeLessThanOrEqual(100);
        expect(meta.hookTitle.endsWith('#Shorts')).toBe(true);
      });
    });

    describe('3.2 Platform Character Budget & Guaranteed Attribution URL Preservation', () => {
      it('adheres to TikTok 2200 character ceiling under nominal input', () => {
        const meta = generateViralMetadata({
          topic: 'Kiếm $10k/tháng với Video AI',
          niche: 'solopreneur',
          targetPlatform: 'tiktok',
          targetLanguage: 'vi',
          targetMarket: 'hanoi',
          keyTakeaways: ['Tiết kiệm 90% thời gian', 'Tự động lên lịch 4 nền tảng'],
        });

        expect(meta.seoDescription.length).toBeLessThanOrEqual(2200);
        expect(meta.isCompliant).toBe(true);
        expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
        expect(meta.seoDescription).toContain(meta.telegramDeepLink);
      });

      it('VERIFIES FIX: TikTok description truncation preserves trackedFunnelUrl and telegramDeepLink when topic is massive', () => {
        const massiveTopic = 'Viral Automation Masterclass '.repeat(100); // ~3000 chars
        const meta = generateViralMetadata({
          topic: massiveTopic,
          niche: 'ai_automation',
          targetPlatform: 'tiktok',
          targetLanguage: 'en',
          targetMarket: 'singapore',
          referralCode: 'REF_TIKTOK_99',
        });

        // 1. Total length is strictly within limits
        expect(meta.seoDescription.length).toBeLessThanOrEqual(2200);
        expect(meta.charCount.description).toBe(meta.seoDescription.length);
        expect(meta.isCompliant).toBe(true);

        // 2. Both conversion links are 100% preserved
        expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
        expect(meta.seoDescription).toContain(meta.telegramDeepLink);

        // 3. Tracked funnel URL has full UTM parameters
        expect(meta.trackedFunnelUrl).toContain('utm_source=tiktok');
        expect(meta.trackedFunnelUrl).toContain('utm_medium=short_video');
        expect(meta.trackedFunnelUrl).toContain('utm_campaign=ai_automation');
        expect(meta.trackedFunnelUrl).toContain('ref=REF_TIKTOK_99');

        // 4. Attribution block is at the tail of the description
        const lastLinkIndex = meta.seoDescription.lastIndexOf(meta.telegramDeepLink);
        expect(lastLinkIndex).toBeGreaterThan(meta.seoDescription.length - 300);
      });

      it('VERIFIES FIX: Instagram Reels (2200 max) preserves tracked links under massive description', () => {
        const massiveTopic = 'Scale your e-commerce business to seven figures '.repeat(70);
        const meta = generateViralMetadata({
          topic: massiveTopic,
          niche: 'ecommerce',
          targetPlatform: 'instagram_reels',
          targetLanguage: 'en',
          targetMarket: 'singapore',
          keyTakeaways: Array.from({ length: 15 }, (_, i) => `Takeaway #${i + 1}: Automated workflows reduce churn drastically`),
        });

        expect(meta.seoDescription.length).toBeLessThanOrEqual(2200);
        expect(meta.isCompliant).toBe(true);
        expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
        expect(meta.seoDescription).toContain(meta.telegramDeepLink);
        expect(meta.trackedFunnelUrl).toContain('utm_source=instagram_reels');
      });

      it('VERIFIES FIX: Facebook Reels (2200 max) preserves tracked links under massive description', () => {
        const massiveTopic = 'Xây dựng đế chế kinh doanh trực tuyến đỉnh cao '.repeat(60);
        const meta = generateViralMetadata({
          topic: massiveTopic,
          niche: 'solopreneur',
          targetPlatform: 'facebook_reels',
          targetLanguage: 'vi',
          targetMarket: 'hanoi',
          keyTakeaways: Array.from({ length: 20 }, (_, i) => `Bước ${i + 1}: Tối ưu hóa phễu chuyển đổi tự động`),
        });

        expect(meta.seoDescription.length).toBeLessThanOrEqual(2200);
        expect(meta.isCompliant).toBe(true);
        expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
        expect(meta.seoDescription).toContain(meta.telegramDeepLink);
        expect(meta.trackedFunnelUrl).toContain('utm_source=facebook_reels');
      });

      it('VERIFIES FIX: YouTube Shorts (5000 max) preserves tracked links under extreme 10,000-character payload', () => {
        const extremeTopic = 'Autonomous Multi-Platform Dubbing and Syndication System '.repeat(150); // ~8500 chars
        const meta = generateViralMetadata({
          topic: extremeTopic,
          niche: 'ai_automation',
          targetPlatform: 'youtube_shorts',
          targetLanguage: 'en',
          targetMarket: 'tokyo',
          keyTakeaways: Array.from({ length: 30 }, (_, i) => `Key Takeaway ${i + 1}: Full edge CDN streaming with 0ms latency`),
          referralCode: 'YT_HERO_5000',
        });

        expect(meta.seoDescription.length).toBeLessThanOrEqual(5000);
        expect(meta.isCompliant).toBe(true);
        expect(meta.seoDescription).toContain(meta.trackedFunnelUrl);
        expect(meta.seoDescription).toContain(meta.telegramDeepLink);
        expect(meta.trackedFunnelUrl).toContain('utm_source=youtube_shorts');
        expect(meta.trackedFunnelUrl).toContain('ref=YT_HERO_5000');
      });
    });

    describe('3.3 Twitter / X 280-Character Budget with URL Intactness', () => {
      it('verifies viral-distributor correctly truncates title to keep tracked URL intact on Twitter (280 chars)', () => {
        const longTitle = 'Bí Quyết Tự Động Hóa Toàn Diện 100% Video Ngắn Đa Kênh Cho Doanh Nghiệp Với Trí Tuệ Nhân Tạo Năm 2026';
        const formatted = formatPlatformCaption('x', {
          videoTitle: longTitle,
          niche: 'ai_automation',
          hookArchetype: 'curiosity_gap',
          videoId: 'vid_123',
        });

        expect(formatted.caption.length).toBeLessThanOrEqual(280);
        // Tracked URL must remain completely intact at the end
        expect(formatted.caption).toContain(formatted.trackedUrl);
      });
    });

    describe('3.4 Telegram Bot Deep Link 64-Byte Payload Constraint', () => {
      it('enforces 64-character payload limit on Telegram /start deep links', () => {
        const link = buildTelegramDeepLink({
          botUsername: 'Sophia_Bbot',
          videoId: 'vid_9876543210abcdefghijklmnop',
          platform: 'youtube_shorts',
          niche: 'ai_automation_super_long_niche_identifier',
          referralCode: 'REF_EXTREMELY_LONG_CODE_1234567890',
        });

        const startParam = new URL(link).searchParams.get('start') || '';
        expect(startParam.length).toBeLessThanOrEqual(64);
        expect(/^[a-zA-Z0-9_]+$/.test(startParam)).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DOMAIN 4: Adaptive HLS Manifest Generator Stress Tests
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Domain 4: Adaptive HLS Manifest Generator Stress Tests', () => {

    describe('4.1 Single-Variant Fallback & Custom Ladders', () => {
      it('generates valid RFC 8216 master playlist with a single variant', () => {
        const singleVariant: HlsVariantStream = {
          quality: '720p',
          bandwidth: 2800000,
          width: 1280,
          height: 720,
          url: 'https://cdn.example.com/720p/index.m3u8',
          uri: '720p/index.m3u8',
        };

        const manifest = generateMasterManifest({
          variants: [singleVariant],
          independentSegments: true,
        });

        expect(manifest).toContain('#EXTM3U');
        expect(manifest).toContain('#EXT-X-VERSION:6');
        expect(manifest).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
        expect(manifest).toContain('BANDWIDTH=2800000,RESOLUTION=1280x720');
        expect(manifest).toContain('https://cdn.example.com/720p/index.m3u8');
        // Only 1 variant line
        const streamInfCount = (manifest.match(/#EXT-X-STREAM-INF/g) || []).length;
        expect(streamInfCount).toBe(1);
      });

      it('falls back to default 3-tier ladder (1080p, 720p, 480p) when variants array is empty', () => {
        const manifest = generateMasterManifest({ variants: [] });
        const streamInfCount = (manifest.match(/#EXT-X-STREAM-INF/g) || []).length;
        expect(streamInfCount).toBe(3);
        expect(manifest).toContain('BANDWIDTH=5000000');
        expect(manifest).toContain('BANDWIDTH=2800000');
        expect(manifest).toContain('BANDWIDTH=1400000');
      });
    });

    describe('4.2 Missing Audio Groups & Demuxed Signaling', () => {
      it('does NOT emit AUDIO="..." attribute when no audioTracks are provided (multiplexed audio)', () => {
        const manifest = generateMasterManifest({
          audioTracks: [],
        });

        expect(manifest).not.toContain('#EXT-X-MEDIA:TYPE=AUDIO');
        expect(manifest).not.toContain('AUDIO="');
      });

      it('correctly signals demuxed multi-language audio tracks with default flags', () => {
        const audioTracks: HlsAudioTrack[] = [
          { id: 'a1', language: 'vi', name: 'Vietnamese', isDefault: true, autoSelect: true, uri: 'audio/vi.m3u8' },
          { id: 'a2', language: 'en', name: 'English', isDefault: false, autoSelect: true, uri: 'audio/en.m3u8' },
        ];

        const manifest = generateMasterManifest({ audioTracks });

        expect(manifest).toContain('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="Vietnamese",DEFAULT=YES,AUTOSELECT=YES,LANGUAGE="vi",URI="audio/vi.m3u8"');
        expect(manifest).toContain('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-aac",NAME="English",DEFAULT=NO,AUTOSELECT=YES,LANGUAGE="en",URI="audio/en.m3u8"');
        expect(manifest).toContain('AUDIO="audio-aac"');
      });
    });

    describe('4.3 SPECIFICATION RISK: Bandwidth Ladder Ordering', () => {
      it('EMPIRICAL DEFICIENCY: generateMasterManifest does not enforce sorted bandwidth ladder when given unordered variants', () => {
        // RFC 8216 & Apple HLS Authoring Spec Requirement 1.12:
        // Variants MUST be ordered consistently by bandwidth (ascending or descending).
        const unorderedVariants: HlsVariantStream[] = [
          { quality: '480p', bandwidth: 1400000, width: 854, height: 480, url: '480p.m3u8', uri: '480p.m3u8' },
          { quality: '1080p', bandwidth: 5000000, width: 1920, height: 1080, url: '1080p.m3u8', uri: '1080p.m3u8' },
          { quality: '720p', bandwidth: 2800000, width: 1280, height: 720, url: '720p.m3u8', uri: '720p.m3u8' },
        ];

        const manifest = generateMasterManifest({ variants: unorderedVariants });
        const lines = manifest.split('\n');
        const bandwidthLines = lines.filter((l) => l.startsWith('#EXT-X-STREAM-INF'));

        // Observe that bandwidth lines appear in the raw passed order (1400000 -> 5000000 -> 2800000):
        expect(bandwidthLines[0]).toContain('BANDWIDTH=1400000');
        expect(bandwidthLines[1]).toContain('BANDWIDTH=5000000');
        expect(bandwidthLines[2]).toContain('BANDWIDTH=2800000');
      });
    });

    describe('4.4 RFC 8216 Target Duration Invariant in Media Playlist', () => {
      it('EMPIRICAL SPEC VIOLATION: generateMediaPlaylist does not enforce targetDuration >= max segment duration', () => {
        // RFC 8216 § 4.3.3.1:
        // "The EXTINF duration of each Media Segment in the Playlist file, when rounded to the nearest integer,
        // MUST be less than or equal to the target duration; longer segments can cause playback stalls or other errors."
        const options = {
          targetDurationSec: 5,
          segments: [
            { durationSec: 4.8, uri: 'seg1.ts' },
            { durationSec: 7.2, uri: 'seg2.ts' }, // Exceeds targetDurationSec of 5!
          ],
        };

        const playlist = generateMediaPlaylist(options);

        // Target duration is emitted as 5, but segment 2 has 7.200s duration:
        expect(playlist).toContain('#EXT-X-TARGETDURATION:5');
        expect(playlist).toContain('#EXTINF:7.200,');
        // This is a direct RFC 8216 specification violation.
      });
    });
  });
});
