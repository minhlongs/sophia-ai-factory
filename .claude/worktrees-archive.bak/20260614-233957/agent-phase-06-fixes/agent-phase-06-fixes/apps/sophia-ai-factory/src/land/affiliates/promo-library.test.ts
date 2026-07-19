/**
 * Tests for promo-library — tier filtering + locale filter + ref-link substitution.
 */

import { describe, it, expect } from 'vitest';
import {
  listPromoAssetsForTier,
  fillRefLink,
  COPY_TEMPLATES,
  OUTREACH_SCRIPTS,
  BANNER_SPECS,
} from './promo-library';

describe('listPromoAssetsForTier', () => {
  it('BASIC tier sees only BASIC-min assets across all 3 buckets', () => {
    const result = listPromoAssetsForTier('BASIC');
    expect(result.copyTemplates.every((c) => c.minTier === 'BASIC')).toBe(true);
    expect(result.outreachScripts.every((s) => s.minTier === 'BASIC')).toBe(true);
    expect(result.banners.every((b) => b.minTier === 'BASIC')).toBe(true);
    expect(result.copyTemplates.length).toBeGreaterThan(0);
    expect(result.banners.length).toBeGreaterThan(0);
  });

  it('PREMIUM sees BASIC + PREMIUM, not ENTERPRISE-only', () => {
    const result = listPromoAssetsForTier('PREMIUM');
    const tiers = new Set(result.copyTemplates.map((c) => c.minTier));
    expect(tiers.has('BASIC')).toBe(true);
    expect(tiers.has('PREMIUM')).toBe(true);
    expect(tiers.has('ENTERPRISE')).toBe(false);
  });

  it('MASTER sees every asset', () => {
    const result = listPromoAssetsForTier('MASTER');
    expect(result.copyTemplates.length).toBe(COPY_TEMPLATES.length);
    expect(result.outreachScripts.length).toBe(OUTREACH_SCRIPTS.length);
    expect(result.banners.length).toBe(BANNER_SPECS.length);
  });

  it('locale filter narrows copy + outreach but leaves banners untouched', () => {
    const all = listPromoAssetsForTier('MASTER');
    const en = listPromoAssetsForTier('MASTER', 'en');
    const vi = listPromoAssetsForTier('MASTER', 'vi');

    expect(en.copyTemplates.every((c) => c.locale === 'en')).toBe(true);
    expect(vi.copyTemplates.every((c) => c.locale === 'vi')).toBe(true);
    expect(en.copyTemplates.length + vi.copyTemplates.length).toBe(all.copyTemplates.length);
    expect(en.banners.length).toBe(all.banners.length);
  });

  it('every copy template body includes the {{REF_LINK}} placeholder', () => {
    for (const tpl of COPY_TEMPLATES) {
      expect(tpl.body).toContain('{{REF_LINK}}');
    }
  });
});

describe('fillRefLink', () => {
  it('replaces all {{REF_LINK}} occurrences', () => {
    const body = 'Try this: {{REF_LINK}} or share {{REF_LINK}} with a friend';
    expect(fillRefLink(body, 'https://x.test/r/abc')).toBe(
      'Try this: https://x.test/r/abc or share https://x.test/r/abc with a friend',
    );
  });

  it('leaves body unchanged when no placeholder present', () => {
    expect(fillRefLink('plain text', 'https://x.test')).toBe('plain text');
  });
});
