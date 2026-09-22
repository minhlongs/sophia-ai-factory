import { describe, it, expect } from 'vitest';
import { calculatePromoDiscount } from '../promo-discount-calculator';

describe('calculatePromoDiscount - SOLO100 & Tier Discounts', () => {
  it('applies SOLO100 to Starter (BASIC) tier: $199 - $100 = $99 USD (2,475,000 VND)', () => {
    const result = calculatePromoDiscount('BASIC', 'SOLO100');

    expect(result.applied).toBe(true);
    expect(result.discountUsd).toBe(100);
    expect(result.finalUsd).toBe(99);
    expect(result.finalVnd).toBe(2475000);
    expect(result.promoCode).toBe('SOLO100');
  });

  it('handles case-insensitivity and whitespace in promo code (solo100)', () => {
    const result = calculatePromoDiscount('BASIC', '  solo100  ');

    expect(result.applied).toBe(true);
    expect(result.discountUsd).toBe(100);
    expect(result.finalUsd).toBe(99);
    expect(result.finalVnd).toBe(2475000);
    expect(result.promoCode).toBe('SOLO100');
  });

  it('applies SOLO100 to Growth (PREMIUM) tier: $399 - $100 = $299 USD (7,475,000 VND)', () => {
    const result = calculatePromoDiscount('PREMIUM', 'SOLO100');

    expect(result.applied).toBe(true);
    expect(result.discountUsd).toBe(100);
    expect(result.finalUsd).toBe(299);
    expect(result.finalVnd).toBe(7475000);
  });

  it('does not apply discount if no promo code is provided for Starter tier', () => {
    const result = calculatePromoDiscount('BASIC');

    expect(result.applied).toBe(false);
    expect(result.discountUsd).toBe(0);
    expect(result.finalUsd).toBe(199);
    expect(result.finalVnd).toBe(4975000);
  });

  it('does not apply discount for invalid promo code', () => {
    const result = calculatePromoDiscount('BASIC', 'INVALID_CODE');

    expect(result.applied).toBe(false);
    expect(result.discountUsd).toBe(0);
    expect(result.finalUsd).toBe(199);
    expect(result.promoCode).toBe('INVALID_CODE');
  });

  it('returns standard pricing for ENTERPRISE and MASTER tiers', () => {
    const enterprise = calculatePromoDiscount('ENTERPRISE');
    expect(enterprise.finalUsd).toBe(799);

    const master = calculatePromoDiscount('MASTER');
    expect(master.finalUsd).toBe(4999);
  });
});
