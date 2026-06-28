/**
 * Voice presets registry tests — invariants + accessor functions.
 */

import { describe, it, expect } from 'vitest';
import {
  VOICE_PRESETS,
  canAccessPreset,
  getVoicePreset,
  listPresetsByLanguage,
  listPresetsForTier,
} from '@/seed/voices/presets';

describe('VOICE_PRESETS registry', () => {
  it('contains at least 10 presets (Phase 07 target)', () => {
    expect(VOICE_PRESETS.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique stable IDs', () => {
    const ids = VOICE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('IDs are kebab-case (lowercase, hyphens, alphanumeric only)', () => {
    for (const preset of VOICE_PRESETS) {
      expect(preset.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('every preset has a non-empty Coqui speaker reference', () => {
    for (const preset of VOICE_PRESETS) {
      expect(preset.coquiSpeaker.length).toBeGreaterThan(0);
    }
  });

  it('sample paths are under /voices/ and end in .wav', () => {
    for (const preset of VOICE_PRESETS) {
      expect(preset.samplePath).toMatch(/^\/voices\/.+\.wav$/);
    }
  });

  it('covers at least English and Vietnamese', () => {
    const langs = new Set(VOICE_PRESETS.map((p) => p.language));
    expect(langs.has('en')).toBe(true);
    expect(langs.has('vi')).toBe(true);
  });
});

describe('getVoicePreset', () => {
  it('returns the preset by ID', () => {
    const preset = getVoicePreset('alex-en-m');
    expect(preset).toBeDefined();
    expect(preset?.language).toBe('en');
    expect(preset?.gender).toBe('male');
  });

  it('returns undefined for unknown ID', () => {
    expect(getVoicePreset('does-not-exist')).toBeUndefined();
  });
});

describe('listPresetsByLanguage', () => {
  it('matches by 2-letter prefix (vi-VN → vi)', () => {
    const presets = listPresetsByLanguage('vi-VN');
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.language).toBe('vi');
    }
  });

  it('case-insensitive (EN → en)', () => {
    const presets = listPresetsByLanguage('EN');
    for (const preset of presets) {
      expect(preset.language).toBe('en');
    }
  });

  it('returns empty for unsupported language', () => {
    expect(listPresetsByLanguage('xx')).toEqual([]);
  });
});

describe('canAccessPreset / listPresetsForTier', () => {
  it('BASIC tier can access BASIC presets only', () => {
    const presets = listPresetsForTier('BASIC');
    expect(presets.length).toBeGreaterThan(0);
    for (const preset of presets) {
      expect(preset.minTier).toBe('BASIC');
    }
  });

  it('PREMIUM tier accesses BASIC + PREMIUM', () => {
    const presets = listPresetsForTier('PREMIUM');
    const tiers = new Set(presets.map((p) => p.minTier));
    expect(tiers.has('BASIC')).toBe(true);
    expect(tiers.has('PREMIUM')).toBe(true);
    expect(tiers.has('ENTERPRISE')).toBe(false);
    expect(tiers.has('MASTER')).toBe(false);
  });

  it('MASTER tier accesses every preset', () => {
    expect(listPresetsForTier('MASTER').length).toBe(VOICE_PRESETS.length);
  });

  it('canAccessPreset returns boolean', () => {
    const enterprisePreset = VOICE_PRESETS.find((p) => p.minTier === 'ENTERPRISE');
    if (!enterprisePreset) throw new Error('test fixture: needs an ENTERPRISE preset');
    expect(canAccessPreset('BASIC', enterprisePreset)).toBe(false);
    expect(canAccessPreset('ENTERPRISE', enterprisePreset)).toBe(true);
    expect(canAccessPreset('MASTER', enterprisePreset)).toBe(true);
  });
});
