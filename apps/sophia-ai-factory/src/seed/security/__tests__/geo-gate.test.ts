/**
 * Tests for geo compliance gating.
 */

import { describe, it, expect } from 'vitest';
import {
  isCategoryAllowed,
  resolveAllowedCategories,
  enforceGeoGate,
  GeoBlockedError,
  DEFAULT_GEO_RULES,
} from '../geo-gate';
import type { GeoRule } from '../geo-gate';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isCategoryAllowed', () => {
  it('US user is blocked from crypto', () => {
    expect(isCategoryAllowed('US', 'crypto')).toBe(false);
  });

  it('UK user is blocked from crypto', () => {
    expect(isCategoryAllowed('UK', 'crypto')).toBe(false);
  });

  it('SG user is blocked from crypto', () => {
    expect(isCategoryAllowed('SG', 'crypto')).toBe(false);
  });

  it('CN user is blocked from crypto', () => {
    expect(isCategoryAllowed('CN', 'crypto')).toBe(false);
  });

  it('VN user is allowed crypto (not in block list)', () => {
    expect(isCategoryAllowed('VN', 'crypto')).toBe(true);
  });

  it('unknown country defaults to allowed (fail-open)', () => {
    expect(isCategoryAllowed('', 'crypto')).toBe(true);
    expect(isCategoryAllowed('ZZ', 'crypto')).toBe(true);
  });

  it('unknown category defaults to allowed', () => {
    expect(isCategoryAllowed('US', 'saas')).toBe(true);
    expect(isCategoryAllowed('US', '')).toBe(true);
  });
});

describe('resolveAllowedCategories', () => {
  it('US resolves allowed categories excluding crypto', () => {
    const allowed = resolveAllowedCategories('US');
    expect(allowed).not.toContain('crypto');
  });

  it('VN has crypto in allowed categories', () => {
    const allowed = resolveAllowedCategories('VN');
    expect(allowed).toContain('crypto');
  });
});

describe('enforceGeoGate', () => {
  it('throws GeoBlockedError for US + crypto', () => {
    expect(() => enforceGeoGate('US', 'crypto')).toThrow(GeoBlockedError);
  });

  it('thrown error contains country, category, reason', () => {
    let caught: GeoBlockedError | null = null;
    try {
      enforceGeoGate('SG', 'crypto');
    } catch (e) {
      caught = e as GeoBlockedError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.country).toBe('SG');
    expect(caught!.category).toBe('crypto');
    expect(caught!.reason).toContain('MAS');
  });

  it('does NOT throw for VN + crypto', () => {
    expect(() => enforceGeoGate('VN', 'crypto')).not.toThrow();
  });

  it('does NOT throw for empty country (fail-open)', () => {
    expect(() => enforceGeoGate('', 'crypto')).not.toThrow();
  });
});

describe('custom rule override', () => {
  const customRules: GeoRule[] = [
    {
      category: 'gambling',
      blockedCountries: ['AU', 'US'],
      reason: 'ACMA/DOJ regulation',
    },
  ];

  it('custom rule blocks AU from gambling', () => {
    expect(isCategoryAllowed('AU', 'gambling', customRules)).toBe(false);
  });

  it('custom rule allows VN for gambling', () => {
    expect(isCategoryAllowed('VN', 'gambling', customRules)).toBe(true);
  });

  it('multi-rule lookup — default + custom combined', () => {
    const combined = [...DEFAULT_GEO_RULES, ...customRules];
    expect(isCategoryAllowed('US', 'crypto', combined)).toBe(false);
    expect(isCategoryAllowed('AU', 'gambling', combined)).toBe(false);
    expect(isCategoryAllowed('VN', 'crypto', combined)).toBe(true);
  });

  it('isCategoryAllowed returns boolean type', () => {
    expect(typeof isCategoryAllowed('US', 'crypto')).toBe('boolean');
    expect(typeof isCategoryAllowed('VN', 'crypto')).toBe('boolean');
  });
});
