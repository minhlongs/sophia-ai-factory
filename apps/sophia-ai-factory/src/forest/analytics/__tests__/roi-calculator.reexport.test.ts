/**
 * Smoke test: forest/analytics/roi-calculator re-export barrel
 * Verifies that every exported symbol from the forest barrel
 * is the same reference as the canonical land export.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRoiMetrics as forestCalculateRoiMetrics,
  calculateAggregateRoi as forestCalculateAggregateRoi,
} from '@/forest/analytics/roi-calculator';
import {
  calculateRoiMetrics as landCalculateRoiMetrics,
  calculateAggregateRoi as landCalculateAggregateRoi,
} from '@/land/analytics/roi-calculator';
import type { ROIMetrics as ForestROIMetrics } from '@/forest/analytics/roi-calculator';
import type { ROIMetrics as LandROIMetrics } from '@/land/analytics/roi-calculator';

describe('forest/analytics/roi-calculator re-export barrel', () => {
  it('calculateRoiMetrics is the same reference from both modules', () => {
    expect(typeof forestCalculateRoiMetrics).toBe('function');
    expect(forestCalculateRoiMetrics).toBe(landCalculateRoiMetrics);
  });

  it('calculateAggregateRoi is the same reference from both modules', () => {
    expect(typeof forestCalculateAggregateRoi).toBe('function');
    expect(forestCalculateAggregateRoi).toBe(landCalculateAggregateRoi);
  });

  it('ROIMetrics type is assignable across modules', () => {
    // Type-level check: ensure the re-exported type is identical
    const sample: ForestROIMetrics = {} as LandROIMetrics;
    expect(sample).toBeDefined();
  });
});
