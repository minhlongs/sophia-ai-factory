/**
 * @file live-stock-synchronizer.test.ts
 * @description Unit tests for real-time live stock & surge flash-sale trigger
 */

import { describe, it, expect } from 'vitest';
import { evaluateLiveSurgeVoucher } from '../live-stock-synchronizer';

describe('evaluateLiveSurgeVoucher', () => {
  it('triggers surge voucher when viewers exceed surge threshold', () => {
    const result = evaluateLiveSurgeVoucher({
      currentViewers: 1350,
      baselineViewers: 1000,
      remainingStock: 45,
      surgeThresholdPercentage: 20,
    });

    expect(result.shouldTriggerSurge).toBe(true);
    expect(result.surgePercentage).toBe(35);
    expect(result.recommendedDiscountPercent).toBe(40);
    expect(result.urgencyLevel).toBe('HIGH');
    expect(result.fomoAnnouncementText).toContain('+35%');
  });

  it('sets CRITICAL urgency when stock remaining <= 20', () => {
    const result = evaluateLiveSurgeVoucher({
      currentViewers: 1500,
      baselineViewers: 1000,
      remainingStock: 12,
      surgeThresholdPercentage: 20,
    });

    expect(result.shouldTriggerSurge).toBe(true);
    expect(result.urgencyLevel).toBe('CRITICAL');
  });

  it('does not trigger surge when surge percentage is below threshold', () => {
    const result = evaluateLiveSurgeVoucher({
      currentViewers: 1050,
      baselineViewers: 1000,
      remainingStock: 100,
      surgeThresholdPercentage: 20,
    });

    expect(result.shouldTriggerSurge).toBe(false);
    expect(result.surgePercentage).toBe(5);
    expect(result.urgencyLevel).toBe('LOW');
  });

  it('does not trigger surge if stock is 0', () => {
    const result = evaluateLiveSurgeVoucher({
      currentViewers: 2000,
      baselineViewers: 1000,
      remainingStock: 0,
    });

    expect(result.shouldTriggerSurge).toBe(false);
  });
});
