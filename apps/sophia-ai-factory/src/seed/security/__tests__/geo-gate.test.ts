/**
 * Tests for geo compliance gating — default rules and tenant-aware variants.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isCategoryAllowed,
  resolveAllowedCategories,
  enforceGeoGate,
  resolveTenantRules,
  isCategoryAllowedForTenant,
  GeoBlockedError,
  DEFAULT_GEO_RULES,
} from '../geo-gate';
import type { GeoRule } from '../geo-gate';

// ---------------------------------------------------------------------------
// Helpers: mock registry for tenant-aware tests
// ---------------------------------------------------------------------------

vi.mock('@/seed/tenant-settings/registry', () => ({
  getOrDefault: vi.fn(),
}));

import { getOrDefault } from '@/seed/tenant-settings/registry';

const mockGetOrDefault = getOrDefault as ReturnType<typeof vi.fn>;

function makeDb() {
  return {} as D1Database;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isCategoryAllowed', () => {
  it('US user is allowed crypto when disclosure is applied downstream', () => {
    expect(isCategoryAllowed('US', 'crypto')).toBe(true);
  });

  it('SG user is allowed crypto when disclosure is applied downstream', () => {
    expect(isCategoryAllowed('SG', 'crypto')).toBe(true);
  });

  it('UK user is blocked from crypto (FCA s21 FSMA requires authorisation)', () => {
    expect(isCategoryAllowed('UK', 'crypto')).toBe(false);
  });

  it('CN user is blocked from crypto', () => {
    expect(isCategoryAllowed('CN', 'crypto')).toBe(false);
  });

  it('VN user is blocked from crypto (Decree 52/2024/ND-CP promotion ban)', () => {
    expect(isCategoryAllowed('VN', 'crypto')).toBe(false);
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
  it('US resolves allowed categories including crypto (disclosure required elsewhere)', () => {
    const allowed = resolveAllowedCategories('US');
    expect(allowed).toContain('crypto');
  });

  it('VN does not have crypto in allowed categories', () => {
    const allowed = resolveAllowedCategories('VN');
    expect(allowed).not.toContain('crypto');
  });
});

describe('enforceGeoGate', () => {
  it('does NOT throw for US + crypto (permitted with disclosure downstream)', () => {
    expect(() => enforceGeoGate('US', 'crypto')).not.toThrow();
  });

  it('thrown error contains country, category, reason', () => {
    let caught: GeoBlockedError | null = null;
    try {
      enforceGeoGate('VN', 'crypto');
    } catch (e) {
      caught = e as GeoBlockedError;
    }
    expect(caught).not.toBeNull();
    expect(caught!.country).toBe('VN');
    expect(caught!.category).toBe('crypto');
    expect(caught!.reason).toContain('Decree 52/2024/ND-CP');
  });

  it('throws GeoBlockedError for VN + crypto (Decree 52/2024/ND-CP)', () => {
    expect(() => enforceGeoGate('VN', 'crypto')).toThrow(GeoBlockedError);
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
    expect(isCategoryAllowed('US', 'crypto', combined)).toBe(true);
    expect(isCategoryAllowed('AU', 'gambling', combined)).toBe(false);
    expect(isCategoryAllowed('VN', 'crypto', combined)).toBe(false);
  });

  it('isCategoryAllowed returns boolean type', () => {
    expect(typeof isCategoryAllowed('US', 'crypto')).toBe('boolean');
    expect(typeof isCategoryAllowed('VN', 'crypto')).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Tenant-aware rule resolution tests
// ---------------------------------------------------------------------------

describe('resolveTenantRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns DEFAULT_GEO_RULES when tenant has no overrides', async () => {
    mockGetOrDefault.mockResolvedValue({ additionalRules: [], removedRules: [] });
    const rules = await resolveTenantRules(makeDb(), 'tenant-1');
    expect(rules).toEqual(DEFAULT_GEO_RULES);
  });

  it('appends tenant additionalRules to defaults', async () => {
    mockGetOrDefault.mockResolvedValue({
      additionalRules: [{ category: 'gambling', blockedCountries: ['AU'], reason: 'ACMA' }],
      removedRules: [],
    });
    const rules = await resolveTenantRules(makeDb(), 'tenant-2');
    expect(rules).toHaveLength(DEFAULT_GEO_RULES.length + 1);
    expect(rules.find((r) => r.category === 'gambling')).toBeTruthy();
  });

  it('removedRules filters out a specific country from default block', async () => {
    mockGetOrDefault.mockResolvedValue({
      additionalRules: [],
      removedRules: [{ category: 'crypto', country: 'SG' }],
    });
    const rules = await resolveTenantRules(makeDb(), 'tenant-3');
    const cryptoRule = rules.find((r) => r.category === 'crypto');
    expect(cryptoRule).toBeTruthy();
    // SG is not blocked by default, so removing it leaves the rule unchanged.
    expect(cryptoRule!.blockedCountries).toEqual(['UK', 'CN', 'VN']);
  });

  it('removedRules drops entire rule if all countries removed', async () => {
    mockGetOrDefault.mockResolvedValue({
      additionalRules: [],
      removedRules: [
        { category: 'crypto', country: 'UK' },
        { category: 'crypto', country: 'CN' },
        { category: 'crypto', country: 'VN' },
      ],
    });
    const rules = await resolveTenantRules(makeDb(), 'tenant-4');
    expect(rules.find((r) => r.category === 'crypto')).toBeUndefined();
  });
});

describe('isCategoryAllowedForTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks UK+crypto with default rules', async () => {
    mockGetOrDefault.mockResolvedValue({ additionalRules: [], removedRules: [] });
    const allowed = await isCategoryAllowedForTenant(makeDb(), 'tenant-1', 'UK', 'crypto');
    expect(allowed).toBe(false);
  });

  it('allows UK+crypto after tenant removes UK from crypto block', async () => {
    mockGetOrDefault.mockResolvedValue({
      additionalRules: [],
      removedRules: [{ category: 'crypto', country: 'UK' }],
    });
    const allowed = await isCategoryAllowedForTenant(makeDb(), 'tenant-1', 'UK', 'crypto');
    expect(allowed).toBe(true);
  });

  it('blocks AU+gambling via tenant additionalRules', async () => {
    mockGetOrDefault.mockResolvedValue({
      additionalRules: [{ category: 'gambling', blockedCountries: ['AU'] }],
      removedRules: [],
    });
    const allowed = await isCategoryAllowedForTenant(makeDb(), 'tenant-1', 'AU', 'gambling');
    expect(allowed).toBe(false);
  });
});
