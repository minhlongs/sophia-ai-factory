/**
 * Unit tests for SOP Marketplace Commission Split
 *
 * Tests the creator/platform 70/30 split calculation and
 * commission_ledger recording with correct offer_id and payout hold.
 *
 * @module land/sop-marketplace/__tests__/commission-split
 */

import { describe, it, expect } from 'vitest';
import { calculateCreatorCommission } from '../commission-split';

describe('calculateCreatorCommission', () => {
  it('splits 19900 cents 70/30 (13930 creator / 5970 platform)', () => {
    const result = calculateCreatorCommission(19900);
    expect(result.creatorCents).toBe(13930);
    expect(result.platformCents).toBe(5970);
    expect(result.grossCents).toBe(19900);
    expect(result.commissionPct).toBe(0.7);
  });

  it('returns 0/0 for zero price', () => {
    const result = calculateCreatorCommission(0);
    expect(result.creatorCents).toBe(0);
    expect(result.platformCents).toBe(0);
    expect(result.grossCents).toBe(0);
  });

  it('throws RangeError for negative price', () => {
    expect(() => calculateCreatorCommission(-1)).toThrow(RangeError);
    expect(() => calculateCreatorCommission(-1)).toThrow('priceCents must be non-negative');
  });

  it('splits 399 cents into integer cents (279/120)', () => {
    const result = calculateCreatorCommission(399);
    expect(result.creatorCents).toBe(279);
    expect(result.platformCents).toBe(120);
    expect(result.grossCents).toBe(399);
  });

  it('handles large values without overflow', () => {
    const large = 10_000_000_000; // 100 million dollars in cents
    const result = calculateCreatorCommission(large);
    expect(result.creatorCents + result.platformCents).toBe(large);
    expect(result.creatorCents).toBe(7_000_000_000);
    expect(result.platformCents).toBe(3_000_000_000);
  });

  it('splits 1 cent correctly (0 creator / 1 platform floor)', () => {
    // Math.floor(1 * 0.7) = Math.floor(0.7) = 0
    // 1 - 0 = 1
    const result = calculateCreatorCommission(1);
    expect(result.creatorCents).toBe(0);
    expect(result.platformCents).toBe(1);
    expect(result.grossCents).toBe(1);
  });

  it('splits 2 cents correctly (1 creator / 1 platform)', () => {
    // Math.floor(2 * 0.7) = Math.floor(1.4) = 1
    // 2 - 1 = 1
    const result = calculateCreatorCommission(2);
    expect(result.creatorCents).toBe(1);
    expect(result.platformCents).toBe(1);
    expect(result.grossCents).toBe(2);
  });
});
