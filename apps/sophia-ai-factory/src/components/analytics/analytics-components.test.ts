/**
 * Analytics Components Tests
 */

import { describe, it, expect } from 'vitest';

describe('Analytics Components', () => {
  it('UsageChart should export correctly', async () => {
    const { UsageChart } = await import('@/components/analytics/UsageChart');
    expect(UsageChart).toBeDefined();
  });

  it('QuotaGauge should export correctly', async () => {
    const { QuotaGauge, QuotaGaugeList } = await import('@/components/analytics/QuotaGauge');
    expect(QuotaGauge).toBeDefined();
    expect(QuotaGaugeList).toBeDefined();
  });

  it('ErrorRateChart should export correctly', async () => {
    const { ErrorRateChart } = await import('@/components/analytics/ErrorRateChart');
    expect(ErrorRateChart).toBeDefined();
  });

  it('LicenseMetricsTable should export correctly', async () => {
    const { LicenseMetricsTable } = await import('@/components/analytics/LicenseMetricsTable');
    expect(LicenseMetricsTable).toBeDefined();
  });
});
