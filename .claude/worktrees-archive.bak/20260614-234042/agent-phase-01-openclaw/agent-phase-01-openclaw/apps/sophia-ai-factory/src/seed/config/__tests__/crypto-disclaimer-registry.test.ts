/**
 * crypto-disclaimer-registry.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  CRYPTO_DISCLAIMER_REGISTRY,
  CRYPTO_JURISDICTIONS,
  getDisclaimerForJurisdiction,
  isCryptoBlockedInJurisdiction,
} from '../crypto-disclaimer-registry';

describe('CRYPTO_DISCLAIMER_REGISTRY', () => {
  it('has entries for all 5 jurisdictions', () => {
    expect(Object.keys(CRYPTO_DISCLAIMER_REGISTRY)).toHaveLength(5);
    for (const code of CRYPTO_JURISDICTIONS) {
      expect(CRYPTO_DISCLAIMER_REGISTRY[code]).toBeDefined();
    }
  });

  it('each jurisdiction has short and full text in EN and VI', () => {
    for (const code of CRYPTO_JURISDICTIONS) {
      const disc = CRYPTO_DISCLAIMER_REGISTRY[code];
      expect(disc.short.en.length).toBeGreaterThan(10);
      expect(disc.short.vi.length).toBeGreaterThan(10);
      expect(disc.full.en.length).toBeGreaterThan(30);
      expect(disc.full.vi.length).toBeGreaterThan(30);
    }
  });

  it('VN is blocked, others are not', () => {
    expect(CRYPTO_DISCLAIMER_REGISTRY['VN'].blocked).toBe(true);
    expect(CRYPTO_DISCLAIMER_REGISTRY['US'].blocked).toBe(false);
    expect(CRYPTO_DISCLAIMER_REGISTRY['EU'].blocked).toBe(false);
    expect(CRYPTO_DISCLAIMER_REGISTRY['SG'].blocked).toBe(false);
    expect(CRYPTO_DISCLAIMER_REGISTRY['JP'].blocked).toBe(false);
  });
});

describe('getDisclaimerForJurisdiction', () => {
  it('returns correct disclaimer for known jurisdiction', () => {
    const disc = getDisclaimerForJurisdiction('EU');
    expect(disc.code).toBe('EU');
    expect(disc.short.en).toContain('MiCA');
  });

  it('is case-insensitive', () => {
    const disc = getDisclaimerForJurisdiction('sg');
    expect(disc.code).toBe('SG');
  });

  it('falls back to US for unknown jurisdiction', () => {
    const disc = getDisclaimerForJurisdiction('XX');
    expect(disc.code).toBe('US');
  });
});

describe('isCryptoBlockedInJurisdiction', () => {
  it('returns true for VN', () => {
    expect(isCryptoBlockedInJurisdiction('VN')).toBe(true);
    expect(isCryptoBlockedInJurisdiction('vn')).toBe(true);
  });

  it('returns false for US, EU, SG, JP', () => {
    expect(isCryptoBlockedInJurisdiction('US')).toBe(false);
    expect(isCryptoBlockedInJurisdiction('EU')).toBe(false);
    expect(isCryptoBlockedInJurisdiction('SG')).toBe(false);
    expect(isCryptoBlockedInJurisdiction('JP')).toBe(false);
  });
});
