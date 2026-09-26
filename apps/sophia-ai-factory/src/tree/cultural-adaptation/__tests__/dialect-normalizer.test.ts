/**
 * Regional Dialect Normalizer Comprehensive Unit Tests
 *
 * Covers:
 * 1. English US vs UK bidirectional lexical & spelling normalizations
 * 2. Japanese Tokyo Standard vs Osaka / Kansai dialect normalizations
 * 3. Vietnamese Bắc vs Trung vs Nam dialect normalizations
 * 4. Case preservation, punctuation, and boundary isolation
 * 5. Prosody tuning (pitch, rate, cadence)
 * 6. SSML markup generation
 *
 * @module tree/cultural-adaptation/__tests__/dialect-normalizer.test
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeDialect,
  tuneProsodyForDialect,
  generateSsmlWithDialect,
} from '../dialect-normalizer';

describe('Regional Dialect Normalizer (tree/cultural-adaptation)', () => {
  // ── 1. English US vs UK Normalization ──────────────────────────────────────
  describe('English Dialect Normalization (en-US <-> en-GB)', () => {
    it('translates US English vocabulary to UK English', () => {
      const usText = 'Take the elevator to the apartment, then walk down the sidewalk after vacation.';
      const res = normalizeDialect(usText, 'en-US', 'en-GB');

      expect(res.normalizedText).toContain('lift');
      expect(res.normalizedText).toContain('flat');
      expect(res.normalizedText).toContain('pavement');
      expect(res.normalizedText).toContain('holiday');
      expect(res.replacementsCount).toBeGreaterThanOrEqual(4);
    });

    it('translates UK English vocabulary back to US English', () => {
      const ukText = 'Take the lift to the flat, then walk down the pavement after holiday.';
      const res = normalizeDialect(ukText, 'en-GB', 'en-US');

      expect(res.normalizedText).toContain('elevator');
      expect(res.normalizedText).toContain('apartment');
      expect(res.normalizedText).toContain('sidewalk');
      expect(res.normalizedText).toContain('vacation');
      expect(res.replacementsCount).toBeGreaterThanOrEqual(4);
    });

    it('preserves casing for English tokens (TitleCase and UPPERCASE)', () => {
      const usText = 'The Elevator is fast. The APARTMENT is spacious.';
      const res = normalizeDialect(usText, 'en-US', 'en-GB');

      expect(res.normalizedText).toContain('The Lift is fast');
      expect(res.normalizedText).toContain('The FLAT is spacious');
    });

    it('adapts American -or spelling to British -our', () => {
      const usText = 'The color and flavor of the dish bring great honor to our neighbor.';
      const res = normalizeDialect(usText, 'en-US', 'en-GB');

      expect(res.normalizedText).toContain('colour');
      expect(res.normalizedText).toContain('flavour');
      expect(res.normalizedText).toContain('honour');
      expect(res.normalizedText).toContain('neighbour');
    });

    it('adapts British -our spelling to American -or', () => {
      const ukText = 'The colour and flavour of the dish bring great honour to our neighbour.';
      const res = normalizeDialect(ukText, 'en-GB', 'en-US');

      expect(res.normalizedText).toContain('color');
      expect(res.normalizedText).toContain('flavor');
      expect(res.normalizedText).toContain('honor');
      expect(res.normalizedText).toContain('neighbor');
    });

    it('adapts -ize verbs to -ise verbs for UK English', () => {
      const usText = 'We organize and realize customized workflows.';
      const res = normalizeDialect(usText, 'en-US', 'en-GB');

      expect(res.normalizedText).toContain('organise');
      expect(res.normalizedText).toContain('realise');
      expect(res.normalizedText).toContain('customised');
    });

    it('does not corrupt words that contain target substrings as subwords', () => {
      const text = 'The flat inflation rate and flattered customers.';
      // "flat" should become "apartment", but "inflation" and "flattered" must remain intact
      const res = normalizeDialect(text, 'en-GB', 'en-US');

      expect(res.normalizedText).toContain('apartment');
      expect(res.normalizedText).toContain('inflation');
      expect(res.normalizedText).toContain('flattered');
    });
  });

  // ── 2. Japanese Tokyo vs Osaka / Kansai ──────────────────────────────────────
  describe('Japanese Dialect Normalization (Tokyo <-> Osaka)', () => {
    it('adapts Tokyo standard terms to Osaka / Kansai dialect', () => {
      const tokyoText = '本当にありがとうございます！それはだめです。いくらですか？とても面白い！';
      const res = normalizeDialect(tokyoText, 'ja-JP-tokyo', 'ja-JP-osaka');

      expect(res.normalizedText).toContain('ほんまに');
      expect(res.normalizedText).toContain('おおきに');
      expect(res.normalizedText).toContain('あかん');
      expect(res.normalizedText).toContain('なんぼ');
      expect(res.normalizedText).toContain('めっちゃ');
      expect(res.normalizedText).toContain('おもろい');
    });

    it('adapts Osaka terms back to Tokyo standard', () => {
      const osakaText = 'ほんまにおおきに！それはあかん。なんぼですか？めっちゃおもろい！';
      const res = normalizeDialect(osakaText, 'ja-JP-osaka', 'ja-JP-tokyo');

      expect(res.normalizedText).toContain('本当に');
      expect(res.normalizedText).toContain('ありがとう');
      expect(res.normalizedText).toContain('だめ');
      expect(res.normalizedText).toContain('いくら');
      expect(res.normalizedText).toContain('とても');
      expect(res.normalizedText).toContain('面白い');
    });

    it('handles negative copula and adjectives (じゃない -> やない, いい -> ええ)', () => {
      const tokyoText = '嘘じゃない、いい天気ですね。';
      const res = normalizeDialect(tokyoText, 'ja-JP-tokyo', 'ja-JP-osaka');

      expect(res.normalizedText).toContain('嘘やない');
      expect(res.normalizedText).toContain('ええ天気ですね');
    });
  });

  // ── 3. Vietnamese Bắc vs Trung vs Nam ───────────────────────────────────────
  describe('Vietnamese Regional Dialect Normalization', () => {
    it('adapts Northern (Hà Nội) vocabulary to Southern (Sài Gòn) dialect', () => {
      const bacText = 'Uống một cốc nước ngô, dùng thìa ăn hoa quả cùng bố mẹ, không sợ muộn.';
      const res = normalizeDialect(bacText, 'vi-VN-bac', 'vi-VN-nam');

      expect(res.normalizedText).toContain('ly');
      expect(res.normalizedText).toContain('bắp');
      expect(res.normalizedText).toContain('muỗng');
      expect(res.normalizedText).toContain('trái cây');
      expect(res.normalizedText).toContain('ba má');
      expect(res.normalizedText).toContain('trễ');
    });

    it('adapts Southern vocabulary back to Northern dialect', () => {
      const namText = 'Uống một ly nước bắp, dùng muỗng ăn trái cây cùng ba má, không sợ trễ.';
      const res = normalizeDialect(namText, 'vi-VN-nam', 'vi-VN-bac');

      expect(res.normalizedText).toContain('cốc');
      expect(res.normalizedText).toContain('ngô');
      expect(res.normalizedText).toContain('thìa');
      expect(res.normalizedText).toContain('hoa quả');
      expect(res.normalizedText).toContain('bố mẹ');
      expect(res.normalizedText).toContain('muộn');
    });

    it('adapts Central (Huế/Đà Nẵng) dialect to Standard/Northern', () => {
      const trungText = 'Đi mô rứa? Răng không chộ ai hết?';
      const res = normalizeDialect(trungText, 'vi-VN-trung', 'vi-VN-bac');

      expect(res.normalizedText).toContain('đâu');
      expect(res.normalizedText).toContain('thế');
      expect(res.normalizedText).toContain('Sao');
      expect(res.normalizedText).toContain('thấy');
    });

    it('performs two-step normalization between Central and Southern dialects', () => {
      const trungText = 'Đi mô rứa bạn? Bữa ni ăn bắp uống ly chè.';
      const res = normalizeDialect(trungText, 'vi-VN-trung', 'vi-VN-nam');

      expect(res.normalizedText).toContain('đâu');
      expect(res.normalizedText).toContain('thế');
    });
  });

  // ── 4. Prosody Tuning & SSML ───────────────────────────────────────────────
  describe('Prosody Tuning and SSML Generation', () => {
    it('tunes prosody correctly for UK English RP voice', () => {
      const prosody = tuneProsodyForDialect('en-GB');

      expect(prosody.pitch).toBe('+2Hz');
      expect(prosody.rate).toBe('-2%');
      expect(prosody.cadence).toBe('melodic');
    });

    it('tunes prosody correctly for Osaka dynamic cadence', () => {
      const prosody = tuneProsodyForDialect('ja-JP-osaka');

      expect(prosody.pitch).toBe('+4Hz');
      expect(prosody.rate).toBe('+8%');
      expect(prosody.cadence).toBe('melodic');
    });

    it('tunes prosody correctly for Central Vietnamese gentle melody', () => {
      const prosody = tuneProsodyForDialect('vi-VN-trung');

      expect(prosody.pitch).toBe('-2Hz');
      expect(prosody.rate).toBe('-5%');
      expect(prosody.cadence).toBe('melodic');
    });

    it('generates well-formed SSML with dialect normalization and prosody', () => {
      const result = generateSsmlWithDialect(
        'Take the elevator to the apartment.',
        'en-GB',
        { sourceDialect: 'en-US' },
      );

      expect(result.normalizedText).toContain('lift');
      expect(result.normalizedText).toContain('flat');
      expect(result.ssml).toContain('<speak');
      expect(result.ssml).toContain('<voice name=\'en-GB-SoniaNeural\'>');
      expect(result.ssml).toContain('rate=\'-2%\'');
      expect(result.ssml).toContain('pitch=\'+2Hz\'');
    });
  });
});
