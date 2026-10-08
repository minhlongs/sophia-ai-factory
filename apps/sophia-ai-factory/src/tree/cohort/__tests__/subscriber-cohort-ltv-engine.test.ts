/**
 * @file subscriber-cohort-ltv-engine.test.ts
 * @description Unit tests for Subscriber Cohort LTV & Weibull Hazard Decay Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { computeSubscriberCohortLtv } from '../subscriber-cohort-ltv-engine';
import type { SubscriberCohortInput } from '@/seed/types/growth-triad-v8-types';

describe('Subscriber Cohort LTV Engine (Pillar 3)', () => {
  it('computes survival decay, cumulative LTV and peak hazard month accurately', () => {
    const input: SubscriberCohortInput = {
      cohortMonth: '2026-10',
      initialSubscribers: 1000,
      monthlySubscriptionPriceUsd: 29.0,
      projectionMonths: 12,
      weibullShapeBeta: 1.25,
      weibullScaleLambda: 0.08,
    };

    const report = computeSubscriberCohortLtv(input);

    expect(report.cohortMonth).toBe('2026-10');
    expect(report.survivalCurve).toHaveLength(12);

    // Month 1 survival should be high
    expect(report.survivalCurve[0].survivalProbability).toBeGreaterThan(0.85);
    // Month 12 survival should decline naturally
    expect(report.survivalCurve[11].survivalProbability).toBeLessThan(report.survivalCurve[0].survivalProbability);

    expect(report.cumulativeLtvUsd).toBeGreaterThan(5000);
    expect(report.churnHazardPeakMonth).toBeGreaterThanOrEqual(1);
    expect(report.recommendedAction).toBeTruthy();
  });

  it('handles early peak hazard warning with onboarding intervention', () => {
    const input: SubscriberCohortInput = {
      cohortMonth: '2026-11',
      initialSubscribers: 500,
      monthlySubscriptionPriceUsd: 49.0,
      projectionMonths: 6,
      weibullShapeBeta: 0.8, // Decreasing hazard over time -> peak is early
      weibullScaleLambda: 0.2,
    };

    const report = computeSubscriberCohortLtv(input);

    expect(report.churnHazardPeakMonth).toBeLessThanOrEqual(3);
    expect(report.recommendedAction).toContain('Khẩn cấp: Tăng cường Onboarding');
  });
});
