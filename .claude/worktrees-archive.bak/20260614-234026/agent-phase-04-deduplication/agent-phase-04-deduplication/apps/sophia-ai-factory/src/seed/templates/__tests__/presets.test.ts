/**
 * Tests for template presets registry — tier gating, category filter, lookup, ID stability.
 */

import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_PRESETS,
  getTemplatePreset,
  canAccessTemplate,
  listTemplatesForTier,
} from '../presets';

describe('template presets registry', () => {
  it('ships at least 20 presets (Phase 07 GAP success criterion)', () => {
    expect(TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(20);
  });

  it('every preset has a unique stable id', () => {
    const ids = TEMPLATE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has all required fields populated', () => {
    for (const p of TEMPLATE_PRESETS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
      expect(p.displayName.length).toBeGreaterThan(0);
      expect(p.durationSec).toBeGreaterThan(0);
      expect(p.transitionsJson).not.toBe('');
      expect(() => JSON.parse(p.transitionsJson)).not.toThrow();
    }
  });

  it('covers all 4 categories', () => {
    const cats = new Set(TEMPLATE_PRESETS.map((p) => p.category));
    expect(cats).toEqual(new Set(['educational', 'marketing', 'social', 'brand']));
  });

  it('mix of aspect ratios across catalog', () => {
    const ratios = new Set(TEMPLATE_PRESETS.map((p) => p.aspectRatio));
    expect(ratios.size).toBeGreaterThanOrEqual(3);
  });
});

describe('getTemplatePreset', () => {
  it('returns the preset for a known ID', () => {
    const p = getTemplatePreset('edu-tutorial-16x9');
    expect(p?.displayName).toBe('Tutorial walkthrough');
  });

  it('returns undefined for unknown IDs', () => {
    expect(getTemplatePreset('not-a-real-template')).toBeUndefined();
  });
});

describe('canAccessTemplate + listTemplatesForTier', () => {
  it('BASIC tier sees only BASIC-min presets', () => {
    const list = listTemplatesForTier('BASIC');
    expect(list.every((p) => p.minTier === 'BASIC')).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('PREMIUM tier sees BASIC + PREMIUM, blocks ENTERPRISE-only', () => {
    const list = listTemplatesForTier('PREMIUM');
    const tiers = new Set(list.map((p) => p.minTier));
    expect(tiers.has('BASIC')).toBe(true);
    expect(tiers.has('PREMIUM')).toBe(true);
    expect(tiers.has('ENTERPRISE')).toBe(false);
  });

  it('MASTER tier unlocks the full catalog', () => {
    const list = listTemplatesForTier('MASTER');
    expect(list.length).toBe(TEMPLATE_PRESETS.length);
  });

  it('category filter narrows results', () => {
    const all = listTemplatesForTier('MASTER');
    const social = listTemplatesForTier('MASTER', 'social');
    expect(social.every((p) => p.category === 'social')).toBe(true);
    expect(social.length).toBeLessThan(all.length);
    expect(social.length).toBeGreaterThan(0);
  });

  it('canAccessTemplate gates a specific preset', () => {
    const enterprise = TEMPLATE_PRESETS.find((p) => p.minTier === 'ENTERPRISE');
    expect(enterprise).toBeDefined();
    if (!enterprise) return;
    expect(canAccessTemplate('BASIC', enterprise)).toBe(false);
    expect(canAccessTemplate('ENTERPRISE', enterprise)).toBe(true);
    expect(canAccessTemplate('MASTER', enterprise)).toBe(true);
  });
});
