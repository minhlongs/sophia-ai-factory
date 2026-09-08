/**
 * Unit tests for media-job-economics-aggregate economic aggregation.
 *
 * @module tree/media-jobs/__tests__/media-job-economics-aggregate
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateEconomicMetrics,
  type MediaJobEconomicRow,
} from '../media-job-economics-aggregate';
import { CostClassification } from '@/seed/types/creative-job-economics';

describe('aggregateEconomicMetrics', () => {
  it('test 3: known cost with METERED jobs', () => {
    const rows: MediaJobEconomicRow[] = [
      { status: 'completed', provider_cost: 100, cost_classification: CostClassification.METERED, revenue_attribution: 500, gross_margin: null },
      { status: 'completed', provider_cost: 200, cost_classification: CostClassification.METERED, revenue_attribution: 500, gross_margin: null },
    ];
    const metrics = aggregateEconomicMetrics(rows, 'flux');
    expect(metrics.knownCostJobs).toBe(2);
    expect(metrics.totalKnownProviderCost).toBe(300);
    expect(metrics.averageKnownCostPerJob).toBe(150);
  });

  it('test 4: unknown cost with UNKNOWN jobs', () => {
    const rows: MediaJobEconomicRow[] = [
      { status: 'completed', provider_cost: null, cost_classification: CostClassification.UNKNOWN, revenue_attribution: null, gross_margin: null },
      { status: 'completed', provider_cost: null, cost_classification: CostClassification.UNKNOWN, revenue_attribution: null, gross_margin: null },
    ];
    const metrics = aggregateEconomicMetrics(rows, 'test');
    expect(metrics.unknownCostJobs).toBe(2);
    expect(metrics.knownCostJobs).toBe(0);
    expect(metrics.totalKnownProviderCost).toBeNull();
  });

  it('test 5: unmetered cost with UNMETERED jobs', () => {
    const rows: MediaJobEconomicRow[] = [
      { status: 'completed', provider_cost: null, cost_classification: CostClassification.UNMETERED, revenue_attribution: null, gross_margin: null },
    ];
    const metrics = aggregateEconomicMetrics(rows, 'test');
    expect(metrics.unknownCostJobs).toBe(1);
    expect(metrics.totalKnownProviderCost).toBeNull();
    expect(metrics.averageKnownCostPerJob).toBeNull();
  });

  it('test 6: unknown cost never equals zero (NULL not 0)', () => {
    const rows: MediaJobEconomicRow[] = [
      { status: 'completed', provider_cost: null, cost_classification: null, revenue_attribution: null, gross_margin: null },
    ];
    const metrics = aggregateEconomicMetrics(rows, 'test');
    // Explicitly NOT 0 — must be null
    expect(metrics.totalKnownProviderCost).toBeNull();
    expect(metrics.averageKnownCostPerJob).toBeNull();
    expect(metrics.totalKnownProviderCost).not.toBe(0);
  });

  it('computes gross margin when both cost and revenue present', () => {
    const rows: MediaJobEconomicRow[] = [
      { status: 'completed', provider_cost: 100, cost_classification: CostClassification.METERED, revenue_attribution: 500, gross_margin: null },
    ];
    const metrics = aggregateEconomicMetrics(rows, 'test');
    // ((500 - 100) / 500) * 100 = 80
    expect(metrics.knownGrossMarginPercent).toBe(80);
  });

  it('returns null gross margin when revenue is null', () => {
    const rows: MediaJobEconomicRow[] = [
      { status: 'completed', provider_cost: 100, cost_classification: CostClassification.METERED, revenue_attribution: null, gross_margin: null },
    ];
    const metrics = aggregateEconomicMetrics(rows, 'test');
    expect(metrics.knownGrossMarginPercent).toBeNull();
  });

  it('returns LOW confidence for empty rows', () => {
    const metrics = aggregateEconomicMetrics([], 'empty');
    expect(metrics.totalJobs).toBe(0);
    expect(metrics.dataConfidence).toBe('LOW');
  });
});
