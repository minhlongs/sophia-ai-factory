import { describe, expect, it } from 'vitest';
import {
  buildCssVariablesExport,
  buildFlatDtcgRows,
  getContrastAuditByMode,
  getMotionDurationEntries,
  getMotionEasingEntries,
  getSemanticTokenEntries,
  getTonalPaletteGroups,
  serializeDtcgJson,
} from '../token-catalog';

describe('design-showcase token-catalog', () => {
  it('derives all 29 semantic color roles for dark and light modes', () => {
    const entries = getSemanticTokenEntries();
    expect(entries.length).toBe(29);
    expect(entries.every((entry) => entry.cssVar === `--${entry.role}`)).toBe(true);
    expect(entries.every((entry) => /^#[0-9A-Fa-f]{6}$/.test(entry.darkValue))).toBe(true);
    expect(entries.every((entry) => /^#[0-9A-Fa-f]{6}$/.test(entry.lightValue))).toBe(true);
  });

  it('derives tonal palette groups and motion tokens from canonical seed', () => {
    const tonal = getTonalPaletteGroups();
    expect(tonal.map((g) => g.family)).toEqual(
      expect.arrayContaining(['indigo', 'violet', 'amber', 'emerald', 'rose', 'neutral']),
    );

    const durations = getMotionDurationEntries();
    expect(durations.map((d) => d.role)).toEqual([
      'instant',
      'fast',
      'normal',
      'deliberate',
      'cinematic',
    ]);

    const easings = getMotionEasingEntries();
    expect(easings.map((e) => e.role)).toEqual([
      'standard',
      'emphasized',
      'decelerate',
      'accelerate',
    ]);
    expect(easings[0]?.cssValue).toMatch(/^cubic-bezier\(/);
  });

  it('audits WCAG 2.2 AA contrast with 100% pass rate in both dark and light modes', () => {
    for (const mode of ['dark', 'light'] as const) {
      const rows = getContrastAuditByMode(mode);
      expect(rows.length).toBeGreaterThanOrEqual(12);
      expect(rows.every((row) => row.passes)).toBe(true);
    }
  });

  it('flattens all DTCG categories into unique searchable rows', () => {
    const rows = buildFlatDtcgRows();
    const categories = new Set(rows.map((r) => r.category));
    expect(categories).toEqual(
      new Set(['semantic-dark', 'semantic-light', 'tonal', 'typography', 'motion']),
    );
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.size).toBe(rows.length);
  });

  it('exports valid CSS custom properties and valid DTCG 2025.10 JSON', () => {
    const darkCss = buildCssVariablesExport('dark');
    expect(darkCss).toContain('.dark {');
    expect(darkCss).toContain('--primary:');
    expect(darkCss).toContain('--motion-duration-fast: 150ms;');

    const lightCss = buildCssVariablesExport('light');
    expect(lightCss).toContain(':root {');
    expect(lightCss).toContain('--surface:');

    const jsonText = serializeDtcgJson();
    const parsed = JSON.parse(jsonText) as { meta: { system: string; version: string } };
    expect(parsed.meta.system).toBe('ZEN DESIGN OS');
    expect(parsed.meta.version).toBe('1.0.0');
  });
});
