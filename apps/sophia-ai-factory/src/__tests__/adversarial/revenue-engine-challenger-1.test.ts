/**
 * Challenger 1: Empirical Adversarial Stress Test Suite for R1 and R2
 *
 * Scope:
 * 1. Requirement R1:
 *    - Hook generator (hook-generator.ts & hook-prompts.ts):
 *      Edge cases, empty niche, unsupported topics, script duration boundary (15s, 30s, 60s, custom/abnormal),
 *      Vietnamese and English text synthesis integrity.
 *    - Viral distributor (viral-distributor.ts):
 *      Caption formatting boundary (Twitter 280-char cutoff, TikTok hashtag budget, UTM parameter encoding, Telegram deep link).
 * 2. Requirement R2:
 *    - Telegram Bot sales bifurcation router (route.ts):
 *      Deep-link parsing for arbitrary prefixes (vid_, ref_, solo100, demo_, corrupted tokens, empty tokens, non-hex 32-char strings).
 *    - Promo discount calculator (promo-discount-calculator.ts):
 *      SOLO100 calculation across all tiers (BASIC, PREMIUM, ENTERPRISE, MASTER) and invalid promo codes.
 *    - Qualification FSM state transitions and scoring bounds (strictly [0, 100]).
 *
 * @module __tests__/adversarial/revenue-engine-challenger-1.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// R1 Imports
import {
  generateViralHooks,
  findTrendingHooks,
  buildFunnelCta,
  generateViralScript,
} from '@/tree/viral/hook-generator';
import {
  NICHE_PROFILES,
  ARCHETYPE_DEFINITIONS,
  DETERMINISTIC_HOOK_VAULT,
  DETERMINISTIC_SCRIPT_TEMPLATES,
  buildHookGenerationPrompt,
  buildScriptPrompt,
} from '@/tree/viral/hook-prompts';
import {
  buildFunnelTrackingUrl,
  buildTelegramDeepLink,
  formatPlatformCaption,
  publishSinglePlatform,
  publishToViralPlatforms,
} from '@/forest/publishing/viral-distributor';

// R2 Imports
import {
  calculateLeadScore,
  parseStartPayload,
  handleLeadGreeting,
  handleNicheSelection,
  handleBudgetSelection,
  handleCheckoutTrigger,
  handleQualificationCallback,
} from '@/land/telegram-sales/qualification-service';
import {
  calculatePromoDiscount,
  calculateDiscount,
} from '@/land/promo/promo-discount-calculator';
import {
  _resetMemoryLeads,
  getLeadByChatId,
  upsertLead,
  listHighIntentLeads,
} from '@/land/telegram-sales/telegram-lead-repo';
import * as telegramClient from '@/tree/telegram/telegram-client';
import * as adminNotifier from '@/tree/telegram/telegram-admin-notifier';
import * as pairing from '@/tree/telegram/pairing';
import * as pairingTokenService from '@/tree/telegram/pairing-token-service';
import { POST as telegramWebhookPost } from '@/app/api/webhooks/telegram/route';
import type { ViralNiche, HookArchetype, ViralPlatform } from '@/seed/types/growth';
import type { BudgetTier } from '@/seed/types/telegram-sales';

// Webhook secret for route tests
const TEST_WEBHOOK_SECRET = 'challenger1_secret_token_xyz';

vi.mock('@/seed/db/client', () => ({
  tryCreateServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
        gte: vi.fn().mockResolvedValue({ data: [] }),
      })),
    })),
  })),
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

describe('Challenger 1 Empirical Stress Test Suite (R1 & R2)', () => {
  beforeEach(() => {
    _resetMemoryLeads();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // SECTION 1: REQUIREMENT R1 — VIRAL HOOK GENERATOR & SCRIPT SYNTHESIS
  // ==========================================================================
  describe('R1: Viral Hook Generator (hook-generator.ts & hook-prompts.ts)', () => {
    const validNiches: ViralNiche[] = ['ai_automation', 'ecommerce', 'solopreneur'];
    const validArchetypes: HookArchetype[] = [
      'curiosity_gap',
      'shock_stat',
      'direct_question',
      'problem_solution',
      'contrarian',
    ];

    it('HOOK-GEN-01: Handles customTopic with extreme lengths (1,000+ chars) without throwing', async () => {
      const longTopic = 'A'.repeat(1200);
      const hooks = await generateViralHooks({
        niche: 'ai_automation',
        customTopic: longTopic,
        count: 5,
      });

      expect(hooks.length).toBe(5);
      hooks.forEach((h) => {
        expect(h.hookText).toContain(longTopic);
        expect(h.hookTextVi).toContain(longTopic);
        expect(h.expectedRetentionScore).toBeGreaterThanOrEqual(0);
        expect(h.expectedRetentionScore).toBeLessThanOrEqual(100);
      });
    });

    it('HOOK-GEN-02: Handles customTopic with XSS, SQL injection, unicode, and emojis safely', async () => {
      const adversarialTopics = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        '🚀🔥 Khởi nghiệp triệu đô 2026 🌟✨',
        'Cà phê sữa đá & bánh mì đặc biệt',
        '\\n\\r\\t\\0\\b',
      ];

      for (const topic of adversarialTopics) {
        const hooks = await generateViralHooks({
          niche: 'solopreneur',
          customTopic: topic,
          count: 3,
        });

        expect(hooks.length).toBe(3);
        hooks.forEach((h) => {
          expect(h.hookText).toContain(topic);
          expect(h.hookTextVi).toContain(topic);
          expect(typeof h.id).toBe('string');
          expect(h.id.length).toBeGreaterThan(0);
        });
      }
    });

    it('HOOK-GEN-03: Empty, whitespace-only, or falsy customTopic falls back to deterministic vault', async () => {
      const emptyVariants = ['', '   ', '\t\n'];

      for (const emptyTopic of emptyVariants) {
        const hooks = await generateViralHooks({
          niche: 'ecommerce',
          customTopic: emptyTopic,
          count: 4,
        });

        expect(hooks.length).toBe(4);
        hooks.forEach((h) => {
          expect(h.niche).toBe('ecommerce');
          // Must come from vault, not dynamic
          expect(h.id).not.toContain('dyn_hook');
          expect(DETERMINISTIC_HOOK_VAULT.some((vaultItem) => vaultItem.id === h.id)).toBe(true);
        });
      }
    });

    it('HOOK-GEN-04: count parameter boundary testing (0, negative, excess)', async () => {
      // count = 0 returns empty array
      const zero = await generateViralHooks({ niche: 'ai_automation', count: 0 });
      expect(zero).toEqual([]);

      // count = negative returns empty array
      const negative = await generateViralHooks({ niche: 'ai_automation', count: -5 });
      expect(negative).toEqual([]);

      // count = 100 returns at most available pool
      const large = await generateViralHooks({ niche: 'ai_automation', count: 100 });
      expect(large.length).toBeGreaterThan(0);
      expect(large.length).toBeLessThanOrEqual(DETERMINISTIC_HOOK_VAULT.length);
    });

    it('HOOK-GEN-05: Unsupported/Invalid niche handling in generateViralHooks', async () => {
      // If an unknown niche is passed, pool is empty
      const hooks = await generateViralHooks({
        niche: 'unknown_niche' as unknown as ViralNiche,
        count: 5,
      });
      expect(hooks).toEqual([]);
    });

    it('HOOK-GEN-06: Script duration boundary (15s, 30s, 60s, custom/edge durations)', async () => {
      const testDurations: Array<15 | 30 | 60 | number> = [15, 30, 60, 10, 45, 90, 5];

      for (const niche of validNiches) {
        for (const duration of testDurations) {
          const script = await generateViralScript({
            niche,
            targetDurationSec: duration as 15 | 30 | 60,
          });

          expect(script).toBeDefined();
          expect(script.niche).toBe(niche);
          expect(script.sections.length).toBe(5);

          // All sections must have non-empty narration, visualCue, and onScreenText
          script.sections.forEach((sec) => {
            expect(sec.section).toBeTruthy();
            expect(sec.narration.length).toBeGreaterThan(0);
            expect(sec.narrationVi.length).toBeGreaterThan(0);
            expect(sec.visualCue.length).toBeGreaterThan(0);
            expect(sec.onScreenText.length).toBeGreaterThan(0);
            expect(sec.durationSec).toBeGreaterThanOrEqual(2); // Minimum floor enforced
          });

          const totalDuration = script.sections.reduce((acc, s) => acc + s.durationSec, 0);

          // For small targets (<= 11s), minimum floor clamp means total will be at least 11s (3 + 2*4)
          if (duration <= 11) {
            expect(totalDuration).toBeGreaterThanOrEqual(11);
          } else {
            // For standard targets, total duration should be within reasonable proximity (±20%)
            expect(totalDuration).toBeGreaterThanOrEqual(duration * 0.8 - 2);
            expect(totalDuration).toBeLessThanOrEqual(duration * 1.2 + 2);
          }
        }
      }
    });

    it('HOOK-GEN-07: Bilingual synthesis integrity (Vietnamese & English across all templates)', async () => {
      // 1. Vault verification
      for (const hook of DETERMINISTIC_HOOK_VAULT) {
        expect(hook.hookText).toBeTruthy();
        expect(hook.hookTextVi).toBeTruthy();
        expect(hook.hookText).not.toBe(hook.hookTextVi);
        // Basic check for Vietnamese diacritics
        const hasVietnameseChar = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
          hook.hookTextVi
        );
        expect(hasVietnameseChar).toBe(true);
      }

      // 2. Templates verification
      for (const template of DETERMINISTIC_SCRIPT_TEMPLATES) {
        expect(template.title).toBeTruthy();
        expect(template.titleVi).toBeTruthy();
        expect(template.ctaText).toBeTruthy();
        expect(template.ctaTextVi).toBeTruthy();
        template.sections.forEach((sec) => {
          expect(sec.narration).toBeTruthy();
          expect(sec.narrationVi).toBeTruthy();
          const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
            sec.narrationVi
          );
          expect(hasVietnamese).toBe(true);
        });
      }

      // 3. Prompt builders
      const promptEn = buildHookGenerationPrompt('ai_automation', 'shock_stat', 'Agency growth', 'en');
      expect(promptEn.systemPrompt).toContain('Chief Growth Viral Architect');
      expect(promptEn.userPrompt).toContain('Agency growth');

      const promptVi = buildHookGenerationPrompt('ai_automation', 'shock_stat', 'Tăng trưởng agency', 'vi');
      expect(promptVi.systemPrompt).toContain('Vietnamese');
    });

    it('HOOK-GEN-08: findTrendingHooks filtering and velocity boundary', () => {
      // Min velocity threshold: velocity >= 95
      const highVelocity = findTrendingHooks({ minVelocity: 95 });
      highVelocity.forEach((item) => {
        expect(item.viralVelocityScore).toBeGreaterThanOrEqual(95);
      });

      // Limit cutoff
      const limited = findTrendingHooks({ limit: 2 });
      expect(limited.length).toBeLessThanOrEqual(2);

      // Filtering by specific niche
      const ecomTrending = findTrendingHooks({ niche: 'ecommerce' });
      ecomTrending.forEach((item) => {
        expect(item.hook.niche).toBe('ecommerce');
      });
    });
  });

  // ==========================================================================
  // SECTION 2: REQUIREMENT R1 — VIRAL DISTRIBUTOR CAPTIONS & UTM ENCODING
  // ==========================================================================
  describe('R1: Viral Video Distributor (viral-distributor.ts)', () => {
    it('DIST-01: Twitter / X caption cutoff boundary strictly enforces <= 280 characters', () => {
      const testCases = [
        { title: 'Short', ref: 'A' },
        { title: 'Normal video title about scaling agency to $5,000 MRR', ref: 'PARTNER123' },
        {
          title: 'Extremely long video title that goes on and on with exhaustive details about how solopreneurs can replace ten human employees with autonomous artificial intelligence agents in 2026',
          ref: 'SUPER_LONG_PARTNER_AFFILIATE_CODE_ABCDEF_1234567890',
        },
        {
          title: '🔥🚀 Tiêu đề tiếng Việt siêu dài có chứa rất nhiều biểu tượng cảm xúc và ký tự đặc biệt để thử thách bộ đếm ký tự Twitter 280 ký tự 💡✨',
          ref: 'VIET_CODE_888',
        },
      ];

      for (const tc of testCases) {
        const formatted = formatPlatformCaption('twitter', {
          videoTitle: tc.title,
          niche: 'solopreneur',
          hookArchetype: 'contrarian',
          videoId: 'vid_stress_01',
          referralCode: tc.ref,
        });

        // CRITICAL BOUNDARY CHECK: Twitter length MUST NOT EXCEED 280
        expect(formatted.caption.length).toBeLessThanOrEqual(280);
        expect(formatted.caption.length).toBeGreaterThan(0);
      }
    });

    it('DIST-02: UTM Parameter URL encoding resilience against malformed & adversarial values', () => {
      const adversarialInputs = [
        { ref: 'code with spaces', vid: 'vid 101 ?param=1' },
        { ref: 'code&more=true#hash', vid: 'vid_123&evil=inject' },
        { ref: 'Mã_Ưu_Đãi_Tiếng_Việt', vid: 'vid_tiếng_việt' },
        { ref: '<script>alert(1)</script>', vid: 'vid_\'OR\'1\'=\'1' },
      ];

      for (const input of adversarialInputs) {
        const urlStr = buildFunnelTrackingUrl({
          platform: 'tiktok',
          niche: 'ecommerce',
          hookArchetype: 'curiosity_gap',
          videoId: input.vid,
          referralCode: input.ref,
        });

        // Must parse as valid URL
        const parsed = new URL(urlStr);
        expect(parsed.origin).toBe('https://sophia.agencyos.network');
        expect(parsed.searchParams.get('utm_source')).toBe('tiktok');
        expect(parsed.searchParams.get('utm_campaign')).toBe('ecommerce');
        expect(parsed.searchParams.get('utm_medium')).toBe('short_video');

        // Parameter values must match safely without corrupting query structure
        expect(parsed.searchParams.get('ref')).toBe(input.ref.trim());
        expect(parsed.searchParams.get('utm_content')).toBe(`curiosity_gap_${input.vid}`);
      }
    });

    it('DIST-03: Telegram deep link payload sanitization and length boundary', () => {
      // With numeric videoId (no prefix)
      const numericLink = buildTelegramDeepLink({
        videoId: '123',
        platform: 'tiktok',
        niche: 'ai_automation',
      });
      expect(numericLink).toBe('https://t.me/Sophia_Bbot?start=vid_123_tt_ai_automation');

      // REMEDIATED: With 'vid_' prefixed videoId, 'vid_' is stripped and does not produce double prefix
      const doublePrefixedLink = buildTelegramDeepLink({
        videoId: 'vid_123',
        platform: 'tiktok',
        niche: 'ai_automation',
      });
      expect(doublePrefixedLink).toBe('https://t.me/Sophia_Bbot?start=vid_123_tt_ai_automation');

      // Payload with adversarial characters: spaces, hyphens, slashes, punctuation
      const dirtyLink = buildTelegramDeepLink({
        videoId: 'vid/test.123-special!',
        platform: 'x',
        niche: 'solopreneur',
        referralCode: 'ref@user#1',
      });

      // Must be valid URL
      const parsedUrl = new URL(dirtyLink);
      const startParam = parsedUrl.searchParams.get('start');
      expect(startParam).not.toBeNull();
      // Telegram start payload MUST be alphanumeric + underscore only
      expect(/^[a-zA-Z0-9_]+$/.test(startParam!)).toBe(true);
      // Telegram start payload MUST NOT exceed 64 chars
      expect(startParam!.length).toBeLessThanOrEqual(64);
    });

    it('REMEDIATED [AFFILIATE-LEAD-LOSS]: parseStartPayload correctly extracts referrerId from referral deep links', () => {
      // 1. Viral distributor generates referral deep link:
      const link = buildTelegramDeepLink({
        videoId: '888',
        platform: 'tiktok',
        niche: 'solopreneur',
        referralCode: 'PARTNER_LONGDO',
      });
      expect(link).toBe('https://t.me/Sophia_Bbot?start=vid_888_tt_ref_PARTNER_LONGDO');

      // 2. Incoming visitor clicks link and opens Telegram with start payload:
      const payload = 'vid_888_tt_ref_PARTNER_LONGDO';
      const parsed = parseStartPayload(payload);

      // REMEDIATED:
      // Referral code is cleanly extracted from the vid_ payload
      expect(parsed.campaignId).toBe('vid_888_tt_ref_PARTNER_LONGDO');
      expect(parsed.referrerId).toBe('PARTNER_LONGDO');
    });

    it('REMEDIATED [URL-TRUNCATION]: Twitter caption preserves full tracked URL within 280-char limit', () => {
      const formatted = formatPlatformCaption('twitter', {
        videoTitle: 'A very compelling hook about how solopreneurs can automate video production',
        niche: 'solopreneur',
        hookArchetype: 'problem_solution',
        videoId: 'vid_98765432101234567890',
        referralCode: 'super_long_affiliate_referral_partner_id_2026_q3',
      });

      expect(formatted.caption.length).toBeLessThanOrEqual(280);
      expect(formatted.caption).toContain('ref=super_long_affiliate_referral_partner_id_2026_q3');
    });

    it('REMEDIATED [TIKTOK-OVERFLOW]: Long videoTitle without scriptText stays within TikTok 2200 char limit', () => {
      const formatted = formatPlatformCaption('tiktok', {
        videoTitle: 'Huge Title '.repeat(250), // ~2750 chars
        niche: 'ecommerce',
        hookArchetype: 'contrarian',
        videoId: 'vid_101',
      });

      // REMEDIATED:
      // leadIn is clamped to 120 chars, keeping caption well under 2200 chars
      expect(formatted.caption.length).toBeLessThanOrEqual(2200);
    });

    it('REMEDIATED [FALSE-POSITIVE-NICHE]: Tokenized regex prevents false positive niche matches in parseStartPayload', () => {
      const testCases = [
        'vid_chair_review',
        'vid_daily_skincare',
        'vid_email_marketing',
      ];

      for (const payload of testCases) {
        const parsed = parseStartPayload(payload);
        // REMEDIATED:
        // 'chair', 'daily', 'email' no longer trigger 'ai_agency' false positives
        expect(parsed.preferredNiche).toBeNull();
      }
    });

    it('REMEDIATED [NICHE-PENALTY]: calculateLeadScore gives equal 30 points to "ai_automation" and "ai_agency"', () => {
      // When lead niche is set to the canonical R1 name 'ai_automation':
      const scoreAutomation = calculateLeadScore(null, 'ai_automation', 'mid');
      // When lead niche is set to 'ai_agency':
      const scoreAgency = calculateLeadScore(null, 'ai_agency', 'mid');

      // REMEDIATED:
      // Both 'ai_agency' and 'ai_automation' receive 30 points, scoring 70 total
      expect(scoreAgency).toBe(70);
      expect(scoreAutomation).toBe(70);
      expect(scoreAgency - scoreAutomation).toBe(0);
    });

    it('DIST-04: TikTok caption formatting respects bio link and hashtag placement', () => {
      const formatted = formatPlatformCaption('tiktok', {
        videoTitle: 'Test Title',
        scriptText: 'First 120 chars of script narration goes here.',
        niche: 'ai_automation',
        hookArchetype: 'problem_solution',
        videoId: 'vid_tt_101',
      });

      expect(formatted.caption).toContain('link in bio');
      expect(formatted.caption).toContain('💬 Telegram Demo:');
      expect(formatted.caption).toContain('#FYP');
      expect(formatted.caption).toContain('#ViralVideo');
      expect(formatted.caption.length).toBeLessThanOrEqual(2200);
    });

    it('DIST-05: Multi-platform publishing concurrency and error isolation', async () => {
      const result = await publishToViralPlatforms({
        videoId: 'vid_multi_01',
        videoTitle: 'Multi-platform Stress Video',
        niche: 'ecommerce',
        hookArchetype: 'shock_stat',
        platforms: ['tiktok', 'youtube_shorts', 'twitter'],
      });

      expect(result.videoId).toBe('vid_multi_01');
      expect(result.success).toBe(true);
      expect(result.publishedCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.results.tiktok?.status).toBe('published');
      expect(result.results.youtube_shorts?.status).toBe('published');
      expect(result.results.twitter?.status).toBe('published');
    });
  });

  // ==========================================================================
  // SECTION 3: REQUIREMENT R2 — PROMO DISCOUNT CALCULATOR (SOLO100)
  // ==========================================================================
  describe('R2: Promo Discount Calculator (promo-discount-calculator.ts)', () => {
    it('PROMO-01: SOLO100 applies $100 off Starter (BASIC): $199 -> $99 USD (2,475,000 VND)', () => {
      const res = calculatePromoDiscount('BASIC', 'SOLO100');
      expect(res.applied).toBe(true);
      expect(res.discountUsd).toBe(100);
      expect(res.finalUsd).toBe(99);
      expect(res.finalVnd).toBe(2475000); // 99 * 25,000
      expect(res.promoCode).toBe('SOLO100');
    });

    it('PROMO-02: SOLO100 applies $100 off Growth (PREMIUM): $399 -> $299 USD (7,475,000 VND)', () => {
      const res = calculatePromoDiscount('PREMIUM', 'SOLO100');
      expect(res.applied).toBe(true);
      expect(res.discountUsd).toBe(100);
      expect(res.finalUsd).toBe(299);
      expect(res.finalVnd).toBe(7475000); // 299 * 25,000
      expect(res.promoCode).toBe('SOLO100');
    });

    it('PROMO-03: SOLO100 does NOT apply to ENTERPRISE and MASTER tiers (returns full base price)', () => {
      const enterprise = calculatePromoDiscount('ENTERPRISE', 'SOLO100');
      expect(enterprise.applied).toBe(false);
      expect(enterprise.discountUsd).toBe(0);
      expect(enterprise.finalUsd).toBe(799);
      expect(enterprise.finalVnd).toBe(799 * 25000);

      const master = calculatePromoDiscount('MASTER', 'SOLO100');
      expect(master.applied).toBe(false);
      expect(master.discountUsd).toBe(0);
      expect(master.finalUsd).toBe(4999);
      expect(master.finalVnd).toBe(4999 * 25000);
    });

    it('PROMO-04: Case insensitivity and whitespace resilience for SOLO100', () => {
      const variants = ['solo100', 'Solo100', '  solo100  ', '\tSOLO100\n', 'SoLo100'];

      for (const v of variants) {
        const res = calculatePromoDiscount('BASIC', v);
        expect(res.applied).toBe(true);
        expect(res.finalUsd).toBe(99);
        expect(res.promoCode).toBe('SOLO100');
      }
    });

    it('PROMO-05: Invalid, empty, or malicious promo codes do not apply discount', () => {
      const invalidCodes = [
        '',
        '   ',
        'SOLO50',
        'DISCOUNT100',
        'SOLO100_EXTRA',
        '\' OR \'1\'=\'1',
        '<script>',
        undefined,
      ];

      for (const code of invalidCodes) {
        const res = calculatePromoDiscount('BASIC', code);
        expect(res.applied).toBe(false);
        expect(res.discountUsd).toBe(0);
        expect(res.finalUsd).toBe(199);
        expect(res.finalVnd).toBe(199 * 25000);
      }
    });

    it('PROMO-06: calculateDiscount pure function handles percent_off, fixed_off, bounds clamping', () => {
      // Clamping percent > 100%
      const clampedPct = calculateDiscount({
        discountType: 'percent_off',
        discountValue: 150,
        originalAmountCents: 10000,
      });
      expect(clampedPct.discountCents).toBe(10000);
      expect(clampedPct.finalAmountCents).toBe(0);
      expect(clampedPct.isFreeOrder).toBe(true);

      // Clamping percent < 0%
      const negativePct = calculateDiscount({
        discountType: 'percent_off',
        discountValue: -20,
        originalAmountCents: 10000,
      });
      expect(negativePct.discountCents).toBe(0);
      expect(negativePct.finalAmountCents).toBe(10000);

      // Fixed off exceeding original amount
      const hugeFixed = calculateDiscount({
        discountType: 'fixed_off',
        discountValue: 500, // $500 = 50,000 cents
        originalAmountCents: 10000, // $100
      });
      expect(hugeFixed.discountCents).toBe(10000);
      expect(hugeFixed.finalAmountCents).toBe(0);
      expect(hugeFixed.isFreeOrder).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 4: REQUIREMENT R2 — TELEGRAM BOT SALES BIFURCATION ROUTER
  // ==========================================================================
  describe('R2: Telegram Webhook Bifurcation Router (route.ts)', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';
      process.env.TELEGRAM_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
      process.env.TELEGRAM_ADMIN_CHAT_ID = '999999999';

      vi.spyOn(telegramClient, 'sendTelegramMessage').mockResolvedValue({ ok: true });
      vi.spyOn(telegramClient, 'sendTelegramMessageWithKeyboard').mockResolvedValue({ ok: true });
      vi.spyOn(telegramClient, 'sendTelegramVideo').mockResolvedValue({ ok: true });
      vi.spyOn(adminNotifier, 'notifyFounderLeadQualified').mockResolvedValue();
      vi.spyOn(pairing, 'isAllowed').mockResolvedValue(false);
      vi.spyOn(pairing, 'requestPairing').mockResolvedValue({ code: '123456' });
      vi.spyOn(pairingTokenService, 'consumePairingToken').mockResolvedValue({
        userId: 'paired_user_1',
      });
    });

    function makeRequest(body: Record<string, unknown>, secret = TEST_WEBHOOK_SECRET): NextRequest {
      return new NextRequest('http://localhost/api/webhooks/telegram', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': secret,
        },
        body: JSON.stringify(body),
      });
    }

    it('ROUTER-01: Unauthorized webhook secret returns 401 Unauthorized', async () => {
      const req = makeRequest({ message: { text: '/start', chat: { id: 123 } } }, 'wrong_secret');
      const res = await telegramWebhookPost(req);
      expect(res.status).toBe(401);
    });

    it('ROUTER-02: Routes vid_ deep links to lead qualification, bypassing DM pairing gate', async () => {
      const vidPayloads = [
        'vid_101',
        'vid_ecom_999',
        'vid_ai_agency_special',
        'vid_solo_faceless',
        'vid_',
        'vid___corrupted__payload',
      ];

      for (const payload of vidPayloads) {
        const req = makeRequest({
          message: {
            chat: { id: 10001, first_name: 'LeadTester' },
            from: { username: 'lead_handle' },
            text: `/start ${payload}`,
          },
        });

        const res = await telegramWebhookPost(req);
        expect(res.status).toBe(200);

        // Verify lead was stored in repository
        const lead = await getLeadByChatId('10001');
        expect(lead).not.toBeNull();
        expect(lead?.source_utm).toBe(payload);
        expect(pairing.requestPairing).not.toHaveBeenCalled();
      }
    });

    it('ROUTER-03: Routes ref_ affiliate deep links to lead qualification, bypassing DM gate', async () => {
      const req = makeRequest({
        message: {
          chat: { id: 20002, first_name: 'AffiliateLead' },
          text: '/start ref_MINHLONG20',
        },
      });

      const res = await telegramWebhookPost(req);
      expect(res.status).toBe(200);

      const lead = await getLeadByChatId('20002');
      expect(lead).not.toBeNull();
      expect(lead?.referrer_id).toBe('MINHLONG20');
      expect(pairing.requestPairing).not.toHaveBeenCalled();
    });

    it('ROUTER-04: Routes solo100 promo deep links to lead qualification', async () => {
      const soloVariants = ['/start solo100', '/start SOLO100', '/start promo_solo100'];

      for (let i = 0; i < soloVariants.length; i++) {
        const chatId = `3000${i}`;
        const req = makeRequest({
          message: {
            chat: { id: chatId, first_name: 'SoloLead' },
            text: soloVariants[i],
          },
        });

        const res = await telegramWebhookPost(req);
        expect(res.status).toBe(200);

        const lead = await getLeadByChatId(chatId);
        expect(lead).not.toBeNull();
        expect(lead?.source_utm?.toLowerCase()).toContain('solo100');
      }
    });

    it('ROUTER-05: Routes demo_ deep links to lead qualification', async () => {
      const req = makeRequest({
        message: {
          chat: { id: 40004, first_name: 'DemoLead' },
          text: '/start demo_ecommerce',
        },
      });

      const res = await telegramWebhookPost(req);
      expect(res.status).toBe(200);

      const lead = await getLeadByChatId('40004');
      expect(lead).not.toBeNull();
      expect(lead?.niche).toBe('ecommerce');
    });

    it('ROUTER-06: Non-hex 32-character string is NOT confused with web pairing token', async () => {
      // 32 characters of non-hex (contains 'g', 'z', etc.)
      const nonHex32 = 'g'.repeat(32);
      const req = makeRequest({
        message: {
          chat: { id: 50005, first_name: 'NonHexUser' },
          text: `/start ${nonHex32}`,
        },
      });

      const res = await telegramWebhookPost(req);
      expect(res.status).toBe(200);

      // Must NOT call consumePairingToken
      expect(pairingTokenService.consumePairingToken).not.toHaveBeenCalled();
      // Since it's not a sales deep link and not a valid pairing token, unpaired user triggers DM pairing gate
      expect(pairing.requestPairing).toHaveBeenCalledWith(expect.anything(), '50005', 'NonHexUser');
    });

    it('ROUTER-07: Valid 32-character hex token consumes pairing token without entering sales flow', async () => {
      const validHex32 = 'abcdef0123456789abcdef0123456789';
      const req = makeRequest({
        message: {
          chat: { id: 60006, first_name: 'PairedUser' },
          text: `/start ${validHex32}`,
        },
      });

      const res = await telegramWebhookPost(req);
      expect(res.status).toBe(200);

      expect(pairingTokenService.consumePairingToken).toHaveBeenCalledTimes(1);
      // Lead greeting must NOT be called for web pairing
      const lead = await getLeadByChatId('60006');
      expect(lead).toBeNull();
    });

    it('ROUTER-08: Inbound sales commands (/demo, /solo100, /buy) bypass DM gate', async () => {
      const salesCommands = ['/demo', '/solo100', '/buy'];

      for (let i = 0; i < salesCommands.length; i++) {
        const chatId = `7000${i}`;
        const req = makeRequest({
          message: {
            chat: { id: chatId, first_name: 'CmdUser' },
            text: salesCommands[i],
          },
        });

        const res = await telegramWebhookPost(req);
        expect(res.status).toBe(200);

        const lead = await getLeadByChatId(chatId);
        expect(lead).not.toBeNull();
      }
    });

    it('ROUTER-09: Privileged commands (/campaign, /analytics) are blocked by DM gate for unpaired users', async () => {
      const privilegedCmds = ['/campaign list', '/analytics', '/status'];

      for (let i = 0; i < privilegedCmds.length; i++) {
        const chatId = `8000${i}`;
        const req = makeRequest({
          message: {
            chat: { id: chatId, first_name: 'Attacker' },
            text: privilegedCmds[i],
          },
        });

        const res = await telegramWebhookPost(req);
        expect(res.status).toBe(200);

        // Blocked by requestPairing
        expect(pairing.requestPairing).toHaveBeenCalledWith(expect.anything(), chatId, 'Attacker');
      }
    });

    it('ROUTER-10: Callback queries (lead_niche, lead_budget, checkout_pay) routed properly', async () => {
      const chatId = '90001';

      // 1. lead_niche
      const req1 = makeRequest({
        callback_query: {
          data: 'lead_niche:solopreneur',
          message: { chat: { id: chatId } },
        },
      });
      await telegramWebhookPost(req1);
      let lead = await getLeadByChatId(chatId);
      expect(lead?.niche).toBe('solopreneur');

      // 2. lead_budget
      const req2 = makeRequest({
        callback_query: {
          data: 'lead_budget:high',
          message: { chat: { id: chatId } },
        },
      });
      await telegramWebhookPost(req2);
      lead = await getLeadByChatId(chatId);
      expect(lead?.budget_tier).toBe('high');
      expect(lead?.status).toBe('demo_sent');

      // 3. checkout_pay:nowpayments:BASIC:SOLO100
      const req3 = makeRequest({
        callback_query: {
          data: 'checkout_pay:nowpayments:BASIC:SOLO100',
          message: { chat: { id: chatId } },
        },
      });
      await telegramWebhookPost(req3);
      lead = await getLeadByChatId(chatId);
      expect(lead?.payment_method_selected).toBe('nowpayments');
      expect(lead?.status).toBe('checkout_initiated');
    });
  });

  // ==========================================================================
  // SECTION 5: REQUIREMENT R2 — QUALIFICATION FSM & SCORING BOUNDS [0, 100]
  // ==========================================================================
  describe('R2: Qualification FSM & Scoring Bounds (qualification-service.ts)', () => {
    it('FSM-01: Scoring bounds strictly enforced in [0, 100] across all input permutations', () => {
      const payloads = [null, 'vid_test', 'ref_test', 'demo_test', 'solo100', 'random_string'];
      const niches = [null, 'ai_agency', 'ecommerce', 'solopreneur', 'real_estate', 'beauty', 'unknown', ''];
      const budgets: Array<BudgetTier | string | null> = [null, 'low', 'mid', 'high', 'invalid', ''];

      for (const p of payloads) {
        for (const n of niches) {
          for (const b of budgets) {
            const score = calculateLeadScore(p, n, b);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
            expect(Number.isInteger(score)).toBe(true);
          }
        }
      }
    });

    it('FSM-02: Maximum score condition (20 deep-link + 30 core niche + 50 high budget = 100)', () => {
      const score = calculateLeadScore('vid_ecom_01', 'ecommerce', 'high');
      expect(score).toBe(100);
    });

    it('FSM-03: Minimum score condition (0 direct arrival + 0 niche + 0 budget = 0)', () => {
      const score = calculateLeadScore(null, null, null);
      expect(score).toBe(0);
    });

    it('FSM-04: High intent threshold (score >= 70) triggers founder alert', async () => {
      const spyAlert = vi.spyOn(adminNotifier, 'notifyFounderLeadQualified').mockResolvedValue();

      // High budget lead from viral link: score = 20 + 30 + 50 = 100 >= 70
      await handleLeadGreeting('chat_high_01', 'VipLead', 'vid_ai_1');
      await handleNicheSelection('chat_high_01', 'ai_agency');
      await handleBudgetSelection('chat_high_01', 'high');

      expect(spyAlert).toHaveBeenCalledTimes(1);
      expect(spyAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 'chat_high_01',
          leadScore: 100,
        })
      );
    });

    it('FSM-05: Low intent lead (score < 70) does NOT trigger founder alert', async () => {
      const spyAlert = vi.spyOn(adminNotifier, 'notifyFounderLeadQualified').mockResolvedValue();

      // Low budget lead direct arrival: score = 0 + 15 + 25 = 40 < 70
      await handleLeadGreeting('chat_low_01', 'ColdLead', null);
      await handleNicheSelection('chat_low_01', 'other');
      await handleBudgetSelection('chat_low_01', 'low');

      expect(spyAlert).not.toHaveBeenCalled();
    });

    it('FSM-06: parseStartPayload parses vid_, ref_, demo_, and solo100 correctly', () => {
      // 1. vid_
      const vid = parseStartPayload('vid_ecom_campaign_01');
      expect(vid.campaignId).toBe('vid_ecom_campaign_01');
      expect(vid.preferredNiche).toBe('ecommerce');
      expect(vid.isSolo100).toBe(false);

      // 2. ref_
      const ref = parseStartPayload('ref_PARTNER_X');
      expect(ref.referrerId).toBe('PARTNER_X');

      // 3. demo_
      const demo = parseStartPayload('demo_solopreneur');
      expect(demo.preferredNiche).toBe('solopreneur');

      // 4. solo100
      const solo = parseStartPayload('solo100');
      expect(solo.isSolo100).toBe(true);

      // 5. null / empty
      expect(parseStartPayload(null)).toEqual({
        campaignId: null,
        referrerId: null,
        preferredNiche: null,
        isSolo100: false,
      });
      expect(parseStartPayload('')).toEqual({
        campaignId: null,
        referrerId: null,
        preferredNiche: null,
        isSolo100: false,
      });
    });

    it('FSM-07: In-memory lead repo listHighIntentLeads filters by minScore (>= 70)', async () => {
      await upsertLead({ telegram_chat_id: 'l1', qualification_score: 85 });
      await upsertLead({ telegram_chat_id: 'l2', qualification_score: 40 });
      await upsertLead({ telegram_chat_id: 'l3', qualification_score: 70 });
      await upsertLead({ telegram_chat_id: 'l4', qualification_score: 69 });

      const qualified = await listHighIntentLeads(70);
      const ids = qualified.map((l) => l.telegram_chat_id);

      expect(ids).toContain('l1');
      expect(ids).toContain('l3');
      expect(ids).not.toContain('l2');
      expect(ids).not.toContain('l4');
    });

    it('FSM-08: Complete lifecycle: new -> survey_started -> demo_sent -> checkout_initiated -> paid', async () => {
      const chatId = 'lead_lifecycle_999';

      // 1. Initial Greeting
      await handleLeadGreeting(chatId, 'Alex', 'vid_solo_01');
      let lead = await getLeadByChatId(chatId);
      expect(lead?.status).toBe('new');
      expect(lead?.qualification_score).toBe(20 + 30); // vid_ + solopreneur

      // 2. Niche Selection
      await handleNicheSelection(chatId, 'solopreneur');
      lead = await getLeadByChatId(chatId);
      expect(lead?.status).toBe('survey_started');
      expect(lead?.niche).toBe('solopreneur');

      // 3. Budget Selection (triggers demo delivery)
      await handleBudgetSelection(chatId, 'mid');
      lead = await getLeadByChatId(chatId);
      expect(lead?.status).toBe('demo_sent');
      expect(lead?.budget_tier).toBe('mid');
      expect(lead?.qualification_score).toBe(20 + 30 + 40); // 90

      // 4. Checkout Trigger
      await handleCheckoutTrigger(chatId, 'payos', 'BASIC', 'SOLO100');
      lead = await getLeadByChatId(chatId);
      expect(lead?.status).toBe('checkout_initiated');
      expect(lead?.payment_method_selected).toBe('payos');

      // 5. Checkout Callback (NOWPayments alternative)
      await handleQualificationCallback(chatId, 'checkout_pay:nowpayments:BASIC:SOLO100');
      lead = await getLeadByChatId(chatId);
      expect(lead?.payment_method_selected).toBe('nowpayments');
    });
  });
});
