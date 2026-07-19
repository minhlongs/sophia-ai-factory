/**
 * Analytics Components Tests
 */

import { describe, it, expect } from 'vitest';

describe('Analytics Components', () => {
  it('UsageChart should export correctly', async () => {
    const { UsageChart } = await import('@/forest/components/analytics/UsageChart');
    expect(UsageChart).toBeDefined();
  });

  it('QuotaGauge should export correctly', async () => {
    const { QuotaGauge, QuotaGaugeList } = await import('@/forest/components/analytics/QuotaGauge');
    expect(QuotaGauge).toBeDefined();
    expect(QuotaGaugeList).toBeDefined();
  });

  it('ErrorRateChart should export correctly', async () => {
    const { ErrorRateChart } = await import('@/forest/components/analytics/ErrorRateChart');
    expect(ErrorRateChart).toBeDefined();
  });

  it('LicenseMetricsTable should export correctly', async () => {
    const { LicenseMetricsTable } = await import('@/forest/components/analytics/LicenseMetricsTable');
    expect(LicenseMetricsTable).toBeDefined();
  });
});
