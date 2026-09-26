/**
 * Script-Aware Subtitle Cultural Adapter Unit Tests
 *
 * Covers:
 * 1. Script-aware CPS budgeting across Latin, CJK, Thai, and Arabic
 * 2. Reading speed compliance calculation & suggested duration extension
 * 3. Japanese Bunsetsu line-breaking avoiding mid-compound splits
 * 4. Punctuation & decimal number formatting (dot vs comma)
 * 5. Taboo color pairs and WCAG contrast validation
 * 6. Cultural symbol filtering
 *
 * @module tree/cultural-adaptation/__tests__/subtitle-cultural-adapter.test
 */

import { describe, it, expect } from 'vitest';
import {
  getSubtitleCulturalBudget,
  adaptSubtitleCue,
  breakJapaneseBunsetsu,
  formatCulturalNumber,
  validateCulturalVisuals,
} from '../subtitle-cultural-adapter';

describe('Script-Aware Subtitle Cultural Adapter (tree/cultural-adaptation)', () => {
  // ── 1. CPS Budgeting Across Scripts ─────────────────────────────────────────
  describe('CPS Budgeting by Script Family', () => {
    it('provides correct reading speed budgets for Latin, CJK, Thai, and Arabic', () => {
      const enBudget = getSubtitleCulturalBudget('en');
      expect(enBudget.maxCps).toBe(17);
      expect(enBudget.targetCps).toBe(16);
      expect(enBudget.wordWrapMode).toBe('space');

      const jaBudget = getSubtitleCulturalBudget('ja');
      expect(jaBudget.maxCps).toBe(6);
      expect(jaBudget.targetCps).toBe(5);
      expect(jaBudget.wordWrapMode).toBe('bunsetsu');

      const thBudget = getSubtitleCulturalBudget('th');
      expect(thBudget.maxCps).toBe(14);
      expect(thBudget.targetCps).toBe(12);

      const arBudget = getSubtitleCulturalBudget('ar');
      expect(arBudget.maxCps).toBe(15);
      expect(arBudget.targetCps).toBe(14);
    });

    it('validates cue within budget for standard English speech', () => {
      const text = 'Discover Sophia AI Factory today.';
      // 33 characters over 2.5 seconds = 13.2 CPS (< 17 max)
      const res = adaptSubtitleCue(text, 2.5, 'en');

      expect(res.effectiveCps).toBe(13.2);
      expect(res.isWithinBudget).toBe(true);
      expect(res.suggestedDurationSec).toBe(2.5);
    });

    it('calculates duration extension when CJK cue exceeds 6 CPS limit', () => {
      // 25 Japanese characters over 2.0 seconds = 12.5 CPS (severely exceeds max 6 CPS for CJK!)
      const jaText = 'ソフィアAIファクトリーの最先端機能をお届けします。';
      const res = adaptSubtitleCue(jaText, 2.0, 'ja');

      expect(res.effectiveCps).toBe(13);
      expect(res.isWithinBudget).toBe(false);
      // At target 5 CPS, 26 characters requires 5.2 seconds
      expect(res.suggestedDurationSec).toBe(5.2);
    });
  });

  // ── 2. Japanese Bunsetsu Line Breaking ───────────────────────────────────────
  describe('Japanese Bunsetsu Line Breaking', () => {
    it('breaks Japanese subtitles at natural particle and punctuation boundaries', () => {
      const text = '本日は皆様にお集まりいただき、誠にありがとうございます。';
      const lines = breakJapaneseBunsetsu(text, 16);

      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(16);
      }
      // First line should end with comma punctuation or particle
      expect(lines[0].endsWith('、') || lines[0].endsWith('き')).toBe(true);
    });

    it('keeps short Japanese sentences on a single line', () => {
      const shortText = 'こんにちは。';
      const lines = breakJapaneseBunsetsu(shortText, 16);

      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('こんにちは。');
    });
  });

  // ── 3. Cultural Number & Decimal Formatting ─────────────────────────────────
  describe('Cultural Number & Decimal Formatting', () => {
    it('formats numbers with dot decimal for US, UK, and JP', () => {
      const value = 1234567.89;

      expect(formatCulturalNumber(value, 'en')).toBe('1,234,567.89');
      expect(formatCulturalNumber(value, 'ja')).toBe('1,234,567.89');
    });

    it('formats numbers with comma decimal and dot thousands for VN, DE, and FR', () => {
      const value = 1234567.89;

      expect(formatCulturalNumber(value, 'vi')).toBe('1.234.567,89');
      expect(formatCulturalNumber(value, 'de')).toBe('1.234.567,89');
      expect(formatCulturalNumber(value, 'fr')).toBe('1.234.567,89');
    });
  });

  // ── 4. Taboo Visuals & Color Contrast Validation ────────────────────────────
  describe('Visual Cultural Taboo & Contrast Validation', () => {
    it('warns on low color contrast below WCAG AA 4.5:1 ratio', () => {
      // Light grey text on white background
      const res = validateCulturalVisuals(
        { background: '#FFFFFF', foreground: '#DDDDDD' },
        [],
        'en',
      );

      expect(res.compliant).toBe(false);
      expect(res.contrastRatio).toBeLessThan(4.5);
      expect(res.warnings.some((w) => w.includes('contrast ratio'))).toBe(true);
    });

    it('passes high contrast subtitles (white on black)', () => {
      const res = validateCulturalVisuals(
        { background: '#000000', foreground: '#FFFFFF' },
        [],
        'en',
      );

      expect(res.compliant).toBe(true);
      expect(res.contrastRatio).toBe(21);
      expect(res.warnings.length).toBe(0);
    });

    it('flags taboo color pairings in cultural contexts (e.g. white on black in Japanese solemn contexts)', () => {
      const res = validateCulturalVisuals(
        { background: '#FFFFFF', foreground: '#000000' },
        [],
        'ja',
      );

      expect(res.compliant).toBe(false);
      expect(res.warnings.some((w) => w.includes('culturally inauspicious'))).toBe(true);
    });

    it('flags culturally sensitive symbols (e.g. green hat in Chinese)', () => {
      const res = validateCulturalVisuals(
        { background: '#000000', foreground: '#FFFFFF' },
        ['green_hat'],
        'zh',
      );

      expect(res.compliant).toBe(false);
      expect(res.warnings.some((w) => w.includes('green_hat'))).toBe(true);
    });
  });
});
