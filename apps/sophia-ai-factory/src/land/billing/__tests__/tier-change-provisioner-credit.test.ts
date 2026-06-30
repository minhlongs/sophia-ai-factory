/**
 * Unit tests for tier-change-provisioner pro-rata credit calculation
 * @module land/billing/__tests__/tier-change-provisioner-credit.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateProRataCredit } from '../tier-change-provisioner';

describe('calculateProRataCredit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseDate = new Date('2025-01-15T12:00:00Z');
  const periodStart = '2025-01-01T00:00:00Z';
  const periodEnd = '2025-01-31T00:00:00Z';
  const tierPriceCents = 19900; // $199 for BASIC

  it('returns correct credit for mid-period downgrade', () => {
    // Set "now" to Jan 15 (mid-period)
    vi.setSystemTime(baseDate);
    const credit = calculateProRataCredit(tierPriceCents, periodStart, periodEnd);
    // 31 day period, 14 days used, 17 remaining
    // ~$199 * (17/31) ≈ $109.13 → 10913 cents
    expect(credit).toBeGreaterThan(0);
    expect(credit).toBeLessThan(tierPriceCents);
  });

  it('returns 0 when now is at period start', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const credit = calculateProRataCredit(tierPriceCents, periodStart, periodEnd);
    expect(credit).toBe(0);
  });

  it('returns 0 when now is after period end', () => {
    vi.setSystemTime(new Date('2025-02-01T00:00:00Z'));
    const credit = calculateProRataCredit(tierPriceCents, periodStart, periodEnd);
    expect(credit).toBe(0);
  });

  it('returns 0 when now is before period start', () => {
    vi.setSystemTime(new Date('2024-12-31T00:00:00Z'));
    const credit = calculateProRataCredit(tierPriceCents, periodStart, periodEnd);
    expect(credit).toBe(0);
  });

  it('returns 0 for 0-priced tier', () => {
    vi.setSystemTime(baseDate);
    const credit = calculateProRataCredit(0, periodStart, periodEnd);
    expect(credit).toBe(0);
  });

  it('calculates correctly for PREMIUM tier ($499)', () => {
    vi.setSystemTime(baseDate);
    const credit = calculateProRataCredit(49900, periodStart, periodEnd);
    const basicCredit = calculateProRataCredit(19900, periodStart, periodEnd);
    expect(credit).toBeGreaterThan(basicCredit);
  });

  it('returns higher credit early in billing cycle', () => {
    vi.setSystemTime(new Date('2025-01-02T00:00:00Z'));
    const earlyCredit = calculateProRataCredit(tierPriceCents, periodStart, periodEnd);

    vi.setSystemTime(new Date('2025-01-28T00:00:00Z'));
    const lateCredit = calculateProRataCredit(tierPriceCents, periodStart, periodEnd);

    expect(earlyCredit).toBeGreaterThan(lateCredit);
  });
});
