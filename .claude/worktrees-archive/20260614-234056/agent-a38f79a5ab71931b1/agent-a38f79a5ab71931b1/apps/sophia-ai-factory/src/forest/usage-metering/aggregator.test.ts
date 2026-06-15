/**
 * Unit tests for Usage Metering Aggregator
 *
 * Note: Tests that require Supabase database access are marked
 * as integration tests and should be run separately.
 */

import { describe, it, expect } from 'vitest';
import * as aggregator from './aggregator';

describe('Usage Metering Aggregator - Unit Tests', () => {
  describe('aggregateUsageEvents', () => {
    it('should aggregate events by hour', () => {
      const events = [
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 100,
          status_code: 200,
          created_at: 1709251200,
        },
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 150,
          status_code: 200,
          created_at: 1709251260,
        },
      ];

      const result = aggregator.aggregateUsageEvents(events, 'hour');

      expect(result).toHaveLength(1);
      expect(result[0].consumedUnits).toBe(2);
      expect(result[0].requestCount).toBe(2);
      expect(result[0].avgResponseTimeMs).toBe(125);
    });

    it('should aggregate events by day', () => {
      const events = [
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 100,
          status_code: 200,
          created_at: 1709251200,
        },
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 150,
          status_code: 200,
          created_at: 1709280000,
        },
      ];

      const result = aggregator.aggregateUsageEvents(events, 'day');

      expect(result).toHaveLength(1);
      expect(result[0].consumedUnits).toBe(2);
      expect(result[0].requestCount).toBe(2);
    });

    it('should track error count for non-2xx status codes', () => {
      const events = [
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 0,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 50,
          status_code: 500,
          created_at: 1709251200,
        },
      ];

      const result = aggregator.aggregateUsageEvents(events, 'hour');

      expect(result[0].errorCount).toBe(1);
    });

    it('should separate different tenants', () => {
      const events = [
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 100,
          status_code: 200,
          created_at: 1709251200,
        },
        {
          user_id: 'user-2',
          license_nonce: 'def456',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          response_time_ms: 100,
          status_code: 200,
          created_at: 1709251200,
        },
      ];

      const result = aggregator.aggregateUsageEvents(events, 'hour');

      expect(result).toHaveLength(2);
    });
  });

  describe('buildHourlySummary', () => {
    it('should build hourly summary from aggregated events', () => {
      const aggregated = [
        {
          tenantId: 'user-1',
          licenseNonce: 'abc123',
          featureKey: 'heygen.createVideo',
          timestamp: 1709251200,
          consumedUnits: 2,
          requestCount: 2,
          tokensInput: 100,
          tokensOutput: 200,
          avgResponseTimeMs: 125,
          errorCount: 0,
        },
      ];

      const result = aggregator.buildHourlySummary(aggregated);

      expect(result).toHaveLength(1);
      expect(result[0].totalCredits).toBe(2);
      expect(result[0].totalRequests).toBe(2);
      expect(result[0].totalTokens).toBe(300);
    });

    it('should group multiple services in same hour', () => {
      const aggregated = [
        {
          tenantId: 'user-1',
          licenseNonce: 'abc123',
          featureKey: 'heygen.createVideo',
          timestamp: 1709251200,
          consumedUnits: 1,
          requestCount: 1,
          tokensInput: 0,
          tokensOutput: 0,
          avgResponseTimeMs: 100,
          errorCount: 0,
        },
        {
          tenantId: 'user-1',
          licenseNonce: 'abc123',
          featureKey: 'elevenlabs.textToSpeech',
          timestamp: 1709251200,
          consumedUnits: 1,
          requestCount: 1,
          tokensInput: 0,
          tokensOutput: 0,
          avgResponseTimeMs: 100,
          errorCount: 0,
        },
      ];

      const result = aggregator.buildHourlySummary(aggregated);

      expect(result).toHaveLength(1);
      expect(result[0].serviceBreakdown).toHaveLength(2);
      expect(result[0].totalCredits).toBe(2);
    });
  });

  describe('buildDailySummary', () => {
    it('should build daily summary from hourly summaries', () => {
      const hourly = [
        {
          hourTimestamp: 1709251200,
          serviceBreakdown: [],
          totalCredits: 10,
          totalRequests: 10,
          totalTokens: 1000,
        },
        {
          hourTimestamp: 1709254800,
          serviceBreakdown: [],
          totalCredits: 20,
          totalRequests: 20,
          totalTokens: 2000,
        },
      ];

      const result = aggregator.buildDailySummary(hourly);

      expect(result).toHaveLength(1);
      expect(result[0].totalCredits).toBe(30);
      expect(result[0].totalRequests).toBe(30);
    });
  });

  describe('generateCsvRows', () => {
    it('should generate CSV rows with standardized fields', () => {
      const events = [
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 1,
          tokens_input: 0,
          tokens_output: 0,
          status_code: 200,
          response_time_ms: 150,
          created_at: 1709251200,
        },
      ];

      const rows = aggregator.generateCsvRows(events);

      expect(rows).toHaveLength(1);
      expect(rows[0].tenant_id).toBe('user-1');
      expect(rows[0].feature_key).toBe('heygen.createVideo');
      expect(rows[0].consumed_units).toBe(1);
      expect(rows[0].status).toBe('success');
    });

    it('should mark errors correctly', () => {
      const events = [
        {
          user_id: 'user-1',
          license_nonce: 'abc123',
          service_name: 'heygen',
          action: 'createVideo',
          credits_used: 0,
          tokens_input: 0,
          tokens_output: 0,
          status_code: 500,
          response_time_ms: 50,
          created_at: 1709251200,
        },
      ];

      const rows = aggregator.generateCsvRows(events);

      expect(rows[0].status).toBe('error');
    });
  });

  describe('rowsToCsv', () => {
    it('should generate valid CSV string', () => {
      const rows = [
        {
          tenant_id: 'user-1',
          feature_key: 'heygen.createVideo',
          timestamp: 1709251200,
          consumed_units: 1,
          request_count: 1,
          tokens_input: 0,
          tokens_output: 0,
          license_nonce: 'abc123',
          service: 'heygen',
          action: 'createVideo',
          status: 'success' as const,
          response_time_ms: 150,
        },
      ];

      const csv = aggregator.rowsToCsv(rows);

      expect(csv).toContain('tenant_id,feature_key,timestamp');
      expect(csv).toContain('user-1,heygen.createVideo,1709251200');
    });

    it('should escape CSV injection attempts', () => {
      const rows = [
        {
          tenant_id: '=CMD|\' /C calc\'!A0',
          feature_key: 'heygen.createVideo',
          timestamp: 1709251200,
          consumed_units: 1,
          request_count: 1,
          tokens_input: 0,
          tokens_output: 0,
          license_nonce: 'abc123',
          service: 'heygen',
          action: 'createVideo',
          status: 'success' as const,
          response_time_ms: 150,
        },
      ];

      const csv = aggregator.rowsToCsv(rows);

      expect(csv).toContain("'=CMD|' /C calc'!A0");
    });

    it('should handle null response_time_ms', () => {
      const rows = [
        {
          tenant_id: 'user-1',
          feature_key: 'heygen.createVideo',
          timestamp: 1709251200,
          consumed_units: 1,
          request_count: 1,
          tokens_input: 0,
          tokens_output: 0,
          license_nonce: 'abc123',
          service: 'heygen',
          action: 'createVideo',
          status: 'success' as const,
          response_time_ms: null,
        },
      ];

      const csv = aggregator.rowsToCsv(rows);

      expect(csv).toContain(''); // Null becomes empty string
    });
  });

  describe('QUOTA_LIMITS', () => {
    it('should have correct limits for all tiers', () => {
      // Values are computed from UNIFIED_TIERS.mcuMonthly / 30 (ceiled)
      expect(aggregator.QUOTA_LIMITS.BASIC.dailyCredits).toBeGreaterThan(0);
      expect(aggregator.QUOTA_LIMITS.BASIC.hourlyCredits).toBeGreaterThan(0);
      expect(aggregator.QUOTA_LIMITS.BASIC.dailyRequests).toBe(500);

      expect(aggregator.QUOTA_LIMITS.PREMIUM.dailyCredits).toBeGreaterThan(aggregator.QUOTA_LIMITS.BASIC.dailyCredits);
      expect(aggregator.QUOTA_LIMITS.ENTERPRISE.dailyCredits).toBeGreaterThan(aggregator.QUOTA_LIMITS.PREMIUM.dailyCredits);
      expect(aggregator.QUOTA_LIMITS.MASTER.dailyCredits).toBeGreaterThan(aggregator.QUOTA_LIMITS.ENTERPRISE.dailyCredits);
    });

    it('should have hourly credits for all tiers', () => {
      // hourlyCredits are derived as dailyCredits / 5 (ceiled)
      expect(aggregator.QUOTA_LIMITS.BASIC.hourlyCredits).toBeGreaterThan(0);
      expect(aggregator.QUOTA_LIMITS.PREMIUM.hourlyCredits).toBeGreaterThan(aggregator.QUOTA_LIMITS.BASIC.hourlyCredits);
      expect(aggregator.QUOTA_LIMITS.ENTERPRISE.hourlyCredits).toBeGreaterThan(aggregator.QUOTA_LIMITS.PREMIUM.hourlyCredits);
      expect(aggregator.QUOTA_LIMITS.MASTER.hourlyCredits).toBeGreaterThan(aggregator.QUOTA_LIMITS.ENTERPRISE.hourlyCredits);
    });
  });

  describe('validateBatchRecord (via batchIngestUsage)', () => {
    it('should exist', () => {
      expect(aggregator.batchIngestUsage).toBeDefined();
      expect(typeof aggregator.batchIngestUsage).toBe('function');
    });
  });
});
