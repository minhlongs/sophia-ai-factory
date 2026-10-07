/**
 * Unit Tests for Niche Conversion Optimizer
 *
 * Validates UCB1 multi-armed bandit ranking and winner selection.
 * @module land/affiliates/analytics/__tests__/niche-conversion-optimizer.test
 */

import { describe, it, expect } from 'vitest';
import { rankHookVariants, type RawVariantTelemetry } from '../niche-conversion-optimizer';
import type { HookVariant } from '@/tree/video/ab-testing/hook-variant-types';

describe('Niche Conversion Optimizer', () => {
  const sampleVariants: HookVariant[] = [
    {
      id: 'hkv_1',
      angle: 'loss_aversion',
      headline: 'Loss Aversion Hook',
      narration: 'Do not lose money',
      visualPrompt: 'Visual 1',
      overlayText: 'Warning',
      estimatedRetentionScore: 90,
    },
    {
      id: 'hkv_2',
      angle: 'instant_benefit',
      headline: 'Instant Benefit Hook',
      narration: 'Save 10 hours',
      visualPrompt: 'Visual 2',
      overlayText: 'Fast',
      estimatedRetentionScore: 85,
    },
  ];

  it('ranks higher converting variant as winner under sufficient volume', () => {
    const telemetry: RawVariantTelemetry[] = [
      { variantId: 'hkv_1', impressions: 600, clicks: 30, conversions: 2, commissionCents: 5000 },
      { variantId: 'hkv_2', impressions: 600, clicks: 90, conversions: 15, commissionCents: 35000 },
    ];

    const res = rankHookVariants(sampleVariants, telemetry);

    expect(res.winnerVariantId).toBe('hkv_2');
    expect(res.explorationMode).toBe(false);
    expect(res.totalImpressions).toBe(1200);
    expect(res.totalCommissionUsd).toBe(400);

    const winnerMetric = res.rankedMetrics.find((m) => m.variantId === 'hkv_2');
    expect(winnerMetric?.ctr).toBe(15);
    expect(winnerMetric?.conversionRate).toBe(16.67);
  });

  it('indicates exploration mode when total impressions are below threshold', () => {
    const telemetry: RawVariantTelemetry[] = [
      { variantId: 'hkv_1', impressions: 50, clicks: 2, conversions: 0, commissionCents: 0 },
    ];

    const res = rankHookVariants(sampleVariants, telemetry);
    expect(res.explorationMode).toBe(true);
    expect(res.totalImpressions).toBe(50);
  });
});
