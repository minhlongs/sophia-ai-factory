/**
 * Unit tests for metering-reconciler-aggregator
 * @module forest/worker/__tests__/metering-reconciler-aggregator.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aggregateByLicenseAndFeature, markReconciledLogs } from '../lib/metering-reconciler-aggregator';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/tree/usage-metering/kv-metering-log-sync', () => ({
  getMeteringLogs: vi.fn(),
  markAsReconciled: vi.fn().mockResolvedValue(true),
}));

describe('aggregateByLicenseAndFeature', () => {
  it('aggregates logs by license and service', () => {
    const logs = [
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'video-gen', creditsUsed: 50, timestamp: 1000 },
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'video-gen', creditsUsed: 30, timestamp: 2000 },
      { licenseNonce: 'lic_b', userId: 'user_2', service: 'text-to-speech', creditsUsed: 10, timestamp: 1500 },
    ];

    const result = aggregateByLicenseAndFeature(logs);
    expect(result.size).toBe(2);

    const keyA = 'lic_a:video-gen';
    const keyB = 'lic_b:text-to-speech';

    expect(result.get(keyA)!.totalCredits).toBe(80);
    expect(result.get(keyA)!.eventCount).toBe(2);
    expect(result.get(keyB)!.totalCredits).toBe(10);
    expect(result.get(keyB)!.eventCount).toBe(1);
  });

  it('tracks period start and end correctly', () => {
    const logs = [
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'svc', creditsUsed: 10, timestamp: 500 },
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'svc', creditsUsed: 20, timestamp: 3000 },
    ];

    const result = aggregateByLicenseAndFeature(logs);
    const entry = result.get('lic_a:svc')!;
    expect(entry.periodStart).toBe(500);
    expect(entry.periodEnd).toBe(3000);
  });

  it('returns empty map for empty input', () => {
    const result = aggregateByLicenseAndFeature([]);
    expect(result.size).toBe(0);
  });

  it('handles single log entry', () => {
    const logs = [
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'svc', creditsUsed: 25, timestamp: 1000 },
    ];

    const result = aggregateByLicenseAndFeature(logs);
    expect(result.size).toBe(1);
    expect(result.get('lic_a:svc')!.totalCredits).toBe(25);
    expect(result.get('lic_a:svc')!.eventCount).toBe(1);
  });

  it('handles same license different services', () => {
    const logs = [
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'video-gen', creditsUsed: 50, timestamp: 1000 },
      { licenseNonce: 'lic_a', userId: 'user_1', service: 'text-to-speech', creditsUsed: 20, timestamp: 2000 },
    ];

    const result = aggregateByLicenseAndFeature(logs);
    expect(result.size).toBe(2);
    expect(result.get('lic_a:video-gen')!.totalCredits).toBe(50);
    expect(result.get('lic_a:text-to-speech')!.totalCredits).toBe(20);
  });
});

describe('markReconciledLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks logs as reconciled for valid licenses', async () => {
    const { markAsReconciled } = await import('@/tree/usage-metering/kv-metering-log-sync');

    const meteringLogs = [
      { eventId: 'evt_1', licenseNonce: 'lic_a', service: 'svc', creditsUsed: 10, timestamp: 1000, userId: 'u1' },
      { eventId: 'evt_2', licenseNonce: 'lic_b', service: 'svc', creditsUsed: 20, timestamp: 2000, userId: 'u2' },
    ] as never[];

    const validatedLicenses = new Map([
      ['lic_a:svc', { valid: true }],
      ['lic_b:svc', { valid: false, error: 'expired' }],
    ]) as never;

    const count = await markReconciledLogs(meteringLogs, validatedLicenses);
    expect(markAsReconciled).toHaveBeenCalledTimes(1);
    expect(count).toBe(1);
  });

  it('returns 0 when no licenses are valid', async () => {
    const { markAsReconciled } = await import('@/tree/usage-metering/kv-metering-log-sync');

    const meteringLogs = [
      { eventId: 'evt_1', licenseNonce: 'lic_a', service: 'svc', creditsUsed: 10, timestamp: 1000, userId: 'u1' },
    ] as never[];

    const validatedLicenses = new Map([
      ['lic_a:svc', { valid: false, error: 'expired' }],
    ]) as never;

    const count = await markReconciledLogs(meteringLogs, validatedLicenses);
    expect(markAsReconciled).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('returns 0 for empty metering logs', async () => {
    const { markAsReconciled } = await import('@/tree/usage-metering/kv-metering-log-sync');

    const count = await markReconciledLogs([], new Map());
    expect(markAsReconciled).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });
});
