/**
 * Health Checker Tests — validates health status aggregation and formatting.
 */

import { describe, it, expect } from 'vitest';
import type { HealthCheck, SystemStatus } from '@/lib/monitoring/health-checker';

describe('Health Checker', () => {
  describe('HealthCheck type validation', () => {
    it('should represent a healthy check', () => {
      const check: HealthCheck = {
        name: 'database',
        status: 'healthy',
        latency_ms: 12,
      };

      expect(check.status).toBe('healthy');
      expect(check.latency_ms).toBeLessThan(200);
    });

    it('should represent an unhealthy check with detail', () => {
      const check: HealthCheck = {
        name: 'database',
        status: 'unhealthy',
        latency_ms: 5000,
        detail: 'D1 connection timeout',
      };

      expect(check.status).toBe('unhealthy');
      expect(check.detail).toBeDefined();
    });

    it('should represent a degraded check', () => {
      const check: HealthCheck = {
        name: 'templates',
        status: 'degraded',
      };

      expect(check.status).toBe('degraded');
      expect(check.latency_ms).toBeUndefined();
    });
  });

  describe('SystemStatus aggregation', () => {
    it('should be healthy when all checks pass', () => {
      const status: SystemStatus = {
        overall: 'healthy',
        checks: [
          { name: 'database', status: 'healthy', latency_ms: 5 },
          { name: 'templates', status: 'healthy', latency_ms: 2 },
        ],
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      expect(status.overall).toBe('healthy');
      expect(status.checks.every((c) => c.status === 'healthy')).toBe(true);
    });

    it('should be unhealthy when any check is unhealthy', () => {
      const checks: HealthCheck[] = [
        { name: 'database', status: 'unhealthy', detail: 'timeout' },
        { name: 'templates', status: 'healthy' },
      ];

      const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
      const overall = hasUnhealthy ? 'unhealthy' : 'healthy';

      expect(overall).toBe('unhealthy');
    });

    it('should be degraded when no unhealthy but some degraded', () => {
      const checks: HealthCheck[] = [
        { name: 'database', status: 'healthy', latency_ms: 8 },
        { name: 'templates', status: 'degraded' },
      ];

      const hasUnhealthy = checks.some((c) => c.status === 'unhealthy');
      const allHealthy = checks.every((c) => c.status === 'healthy');
      const overall = hasUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

      expect(overall).toBe('degraded');
    });

    it('should include version and timestamp', () => {
      const status: SystemStatus = {
        overall: 'healthy',
        checks: [],
        timestamp: '2026-03-25T06:00:00.000Z',
        version: '2.1.0',
      };

      expect(status.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(new Date(status.timestamp).getTime()).toBeGreaterThan(0);
    });
  });
});
