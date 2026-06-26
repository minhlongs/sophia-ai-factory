/**
 * Unit tests for usage-period-calculator
 * @module forest/usage-metering/__tests__/usage-period-calculator.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolvePeriodTimestamps, getUsageSummaryForPeriod } from '../usage-period-calculator';

// Mock the export module
vi.mock('../export', () => ({
  exportUsage: vi.fn(),
}));

import { exportUsage } from '../export';

describe('UsagePeriodCalculator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolvePeriodTimestamps', () => {
    it('should return current month timestamps', () => {
      const mockDate = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      const result = resolvePeriodTimestamps('current_month');

      const expectedStart = Math.floor(new Date(2025, 0, 1).getTime() / 1000);
      const expectedEnd = Math.floor(mockDate.getTime() / 1000);

      expect(result.startTimestamp).toBe(expectedStart);
      expect(result.endTimestamp).toBe(expectedEnd);

      vi.useRealTimers();
    });

    it('should return last month timestamps', () => {
      const mockDate = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      const result = resolvePeriodTimestamps('last_month');

      const expectedStart = Math.floor(new Date(2024, 11, 1).getTime() / 1000);
      const expectedEnd = Math.floor(new Date(2024, 11, 31).getTime() / 1000);

      expect(result.startTimestamp).toBe(expectedStart);
      expect(result.endTimestamp).toBe(expectedEnd);

      vi.useRealTimers();
    });

    it('should return last 7 days timestamps', () => {
      const mockDate = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      const result = resolvePeriodTimestamps('last_7_days');
      const expectedNow = Math.floor(mockDate.getTime() / 1000);

      expect(result.startTimestamp).toBe(expectedNow - 7 * 86400);
      expect(result.endTimestamp).toBe(expectedNow);

      vi.useRealTimers();
    });

    it('should return last 30 days timestamps for default', () => {
      const mockDate = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      const result = resolvePeriodTimestamps('last_30_days');
      const expectedNow = Math.floor(mockDate.getTime() / 1000);

      expect(result.startTimestamp).toBe(expectedNow - 30 * 86400);
      expect(result.endTimestamp).toBe(expectedNow);

      vi.useRealTimers();
    });

    it('should handle unknown period as last_30_days', () => {
      const mockDate = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      const result = resolvePeriodTimestamps('unknown_period');
      const expectedNow = Math.floor(mockDate.getTime() / 1000);

      expect(result.startTimestamp).toBe(expectedNow - 30 * 86400);
      expect(result.endTimestamp).toBe(expectedNow);

      vi.useRealTimers();
    });
  });

  describe('getUsageSummaryForPeriod', () => {
    it('should fetch usage summary for given period', async () => {
      const mockDate = new Date('2025-01-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      const mockSummary = [
        { license_nonce: 'lic123', total_credits: 1000, period: 'daily' },
        { license_nonce: 'lic123', total_credits: 5000, period: 'monthly' },
      ];
      const mockAggregated = {
        totalCredits: 6000,
        hourly: [{ hour: '10', credits: 500 }],
        daily: [{ day: '2025-01-15', credits: 1000 }],
      };

      (exportUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
        summary: mockSummary,
        aggregated: mockAggregated,
      });

      const result = await getUsageSummaryForPeriod('lic123', 'current_month');

      expect(exportUsage).toHaveBeenCalledWith({
        licenseNonce: 'lic123',
        startTimestamp: expect.any(Number),
        endTimestamp: expect.any(Number),
        format: 'json',
      });

      expect(result).toEqual({
        summary: mockSummary,
        totalCredits: 6000,
        startTimestamp: expect.any(Number),
        endTimestamp: expect.any(Number),
        hourly: mockAggregated.hourly,
        daily: mockAggregated.daily,
      });

      vi.useRealTimers();
    });

    it('should calculate totalCredits from summary when aggregated is undefined', async () => {
      const mockSummary = [
        { license_nonce: 'lic123', total_credits: 1000, period: 'daily' },
        { license_nonce: 'lic123', total_credits: 2000, period: 'daily' },
      ];

      (exportUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
        summary: mockSummary,
        aggregated: undefined,
      });

      const result = await getUsageSummaryForPeriod('lic123', 'last_7_days');

      expect(result.totalCredits).toBe(3000);
      expect(result.summary).toEqual(mockSummary);

      vi.useRealTimers();
    });

    it('should use default period current_month', async () => {
      (exportUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
        summary: [],
        aggregated: undefined,
      });

      await getUsageSummaryForPeriod('lic123');

      expect(exportUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          licenseNonce: 'lic123',
          format: 'json',
        })
      );

      vi.useRealTimers();
    });

    it('should pass correct timestamps for last_month', async () => {
      const mockDate = new Date('2025-03-15T12:00:00Z');
      vi.setSystemTime(mockDate);

      (exportUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
        summary: [],
        aggregated: undefined,
      });

      await getUsageSummaryForPeriod('lic123', 'last_month');

      const callArgs = (exportUsage as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.startTimestamp).toBeLessThan(callArgs.endTimestamp);
      const startDate = new Date(callArgs.startTimestamp * 1000);
      expect(startDate.getMonth()).toBe(1); // February

      vi.useRealTimers();
    });

    it('should handle empty summary', async () => {
      (exportUsage as ReturnType<typeof vi.fn>).mockResolvedValue({
        summary: [],
        aggregated: { totalCredits: 0 },
      });

      const result = await getUsageSummaryForPeriod('lic123', 'last_30_days');

      expect(result.totalCredits).toBe(0);
      expect(result.summary).toEqual([]);

      vi.useRealTimers();
    });
  });
});
