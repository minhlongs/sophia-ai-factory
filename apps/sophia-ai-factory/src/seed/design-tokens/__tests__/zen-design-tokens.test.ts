import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ZEN_DESIGN_TOKENS,
  getZenSemanticColor,
  getZenMotionDuration,
  getZenMotionEasingCss,
  getWcagContrastRatio,
  auditZenThemeContrast,
} from '../index';

describe('ZEN DESIGN OS v1.0 — DTCG 2025.10 Token & WCAG 2.2 AA Contrast Suite', () => {
  it('validates canonical DTCG 2025.10 schema metadata and dark-default lock', () => {
    expect(ZEN_DESIGN_TOKENS.$schema).toBe('https://www.designtokens.org/TR/2025.10/format/');
    expect(ZEN_DESIGN_TOKENS.meta.system).toBe('ZEN DESIGN OS');
    expect(ZEN_DESIGN_TOKENS.meta.defaultMode).toBe('dark');
  });

  it('resolves symmetric semantic color roles for both dark and light modes', () => {
    const darkRoles = Object.keys(ZEN_DESIGN_TOKENS.color.semantic.dark).sort();
    const lightRoles = Object.keys(ZEN_DESIGN_TOKENS.color.semantic.light).sort();
    expect(darkRoles).toEqual(lightRoles);
    expect(getZenSemanticColor('dark', 'surface')).toBe('#090A10');
    expect(getZenSemanticColor('light', 'surface')).toBe('#F8F9FC');
    expect(getZenSemanticColor('dark', 'primary')).toBe('#6366F1');
    expect(getZenSemanticColor('light', 'primary')).toBe('#4338CA');
  });

  it('enforces WCAG 2.2 AA contrast thresholds across all Dark Mode semantic pairs', () => {
    const darkAudit = auditZenThemeContrast('dark');
    for (const row of darkAudit) {
      expect(
        row.passes,
        `Dark pair "${row.pair}" (${row.foreground} on ${row.background}) had ratio ${row.ratio}:1 < ${row.minRequired}:1`,
      ).toBe(true);
    }
  });

  it('enforces WCAG 2.2 AA contrast thresholds across all Light Mode semantic pairs', () => {
    const lightAudit = auditZenThemeContrast('light');
    for (const row of lightAudit) {
      expect(
        row.passes,
        `Light pair "${row.pair}" (${row.foreground} on ${row.background}) had ratio ${row.ratio}:1 < ${row.minRequired}:1`,
      ).toBe(true);
    }
  });

  it('verifies runtime CSS parity between src/app/globals.css (:root / .dark) and zen-design-tokens.dtcg.json', () => {
    const globalsCssPath = path.resolve(__dirname, '../../../app/globals.css');
    const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');
    const rootBlock = globalsCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const darkBlock = globalsCss.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

    const parityRoles = [
      'surface',
      'on-surface',
      'on-surface-variant',
      'outline',
      'outline-variant',
      'primary',
      'primary-text',
      'primary-solid',
      'secondary',
      'on-secondary',
      'tertiary',
      'on-tertiary',
      'success',
      'warning',
      'error',
      'info',
    ] as const;

    for (const role of parityRoles) {
      const lightExpected = getZenSemanticColor('light', role);
      const darkExpected = getZenSemanticColor('dark', role);
      expect(
        rootBlock,
        `:root in globals.css must declare --${role}: ${lightExpected}`,
      ).toContain(`--${role}: ${lightExpected}`);
      expect(
        darkBlock,
        `.dark in globals.css must declare --${role}: ${darkExpected}`,
      ).toContain(`--${role}: ${darkExpected}`);
    }
  });

  it('locks Typography Authority to Inter (UI/sans) and JetBrains Mono (code/mono) with zero Satoshi or Instrument Serif', () => {
    expect(ZEN_DESIGN_TOKENS.typography.fontFamily.sans.$value[0]).toBe('Inter');
    expect(ZEN_DESIGN_TOKENS.typography.fontFamily.display.$value[0]).toBe('Inter');
    expect(ZEN_DESIGN_TOKENS.typography.fontFamily.mono.$value[0]).toBe('JetBrains Mono');

    const serialized = JSON.stringify(ZEN_DESIGN_TOKENS.typography);
    expect(serialized).not.toContain('Satoshi');
    expect(serialized).not.toContain('Instrument Serif');
  });

  it('resolves Zen Motion Governance durations and cubic-bezier curves', () => {
    expect(getZenMotionDuration('instant')).toBe('80ms');
    expect(getZenMotionDuration('fast')).toBe('150ms');
    expect(getZenMotionDuration('normal')).toBe('240ms');
    expect(getZenMotionDuration('deliberate')).toBe('400ms');
    expect(getZenMotionDuration('cinematic')).toBe('600ms');
    expect(getZenMotionEasingCss('emphasized')).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(getZenMotionEasingCss('standard')).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });

  it('computes accurate WCAG contrast ratios for boundary colors', () => {
    expect(getWcagContrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(getWcagContrastRatio('#090A10', '#090A10')).toBe(1);
    expect(() => getWcagContrastRatio('#GGG', '#000000')).toThrow();
  });
});
