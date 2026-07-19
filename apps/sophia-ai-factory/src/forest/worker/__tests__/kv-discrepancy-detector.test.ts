/**
 * Unit tests for kv-discrepancy-detector
 * @module forest/worker/__tests__/kv-discrepancy-detector.test
 */

import { describe, it, expect } from 'vitest';
import {
  detectDiscrepancies,
  classifyDiscrepancySeverity,
  filterDiscrepanciesBySeverity,
} from '../lib/kv-discrepancy-detector';

const mockDbEvent = {
  eventId: 'evt_001',
  userId: 'user_1',
  licenseNonce: 'lic_abc',
  service: 'video-gen',
  creditsUsed: 100,
  timestamp: 1700000000,
  idempotencyKey: 'ik_001',
};

const baseKvLog = {
  eventId: 'evt_001',
  userId: 'user_1',
  licenseNonce: 'lic_abc',
  service: 'video-gen',
  creditsUsed: 100,
  timestamp: 1700000000,
  endpoint: '/api/generate',
  action: 'create',
  tokensInput: 50,
  tokensOutput: 150,
  idempotencyKey: 'ik_001',
  tierAtRequest: 'PREMIUM',
  syncedAt: 1700000000,
  reconciledWithGateway: false,
};

describe('detectDiscrepancies', () => {
  it('returns empty array when all events match', () => {
    const result = detectDiscrepancies([mockDbEvent], [baseKvLog]);
    expect(result).toHaveLength(0);
  });

  it('detects missing_in_kv when event exists only in DB', () => {
    const result = detectDiscrepancies([mockDbEvent], []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('missing_in_kv');
    expect(result[0].severity).toBe('medium');
    expect(result[0].eventId).toBe('evt_001');
  });

  it('detects missing_in_db when event exists only in KV', () => {
    const result = detectDiscrepancies([], [baseKvLog]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('missing_in_db');
    expect(result[0].severity).toBe('high');
    expect(result[0].eventId).toBe('evt_001');
  });

  it('detects credit_mismatch when values differ', () => {
    const kvMismatch = { ...baseKvLog, creditsUsed: 150 };
    const result = detectDiscrepancies([mockDbEvent], [kvMismatch]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('credit_mismatch');
    expect(result[0].severity).toBe('critical');
    expect(result[0].details.expected).toBe(100);
    expect(result[0].details.actual).toBe(150);
  });

  it('handles multiple discrepancies in one pass', () => {
    const dbEvents = [
      mockDbEvent,
      { ...mockDbEvent, eventId: 'evt_002', creditsUsed: 200 },
    ];
    const kvLogs = [
      baseKvLog,
      { ...baseKvLog, eventId: 'evt_003', creditsUsed: 300 },
    ];
    const result = detectDiscrepancies(dbEvents, kvLogs);
    // evt_001 matches, evt_002 missing_in_kv, evt_003 missing_in_db
    expect(result).toHaveLength(2);
  });

  it('handles empty input arrays', () => {
    const result = detectDiscrepancies([], []);
    expect(result).toHaveLength(0);
  });

  it('sets timestamp on detected discrepancies', () => {
    const before = Date.now();
    const result = detectDiscrepancies([mockDbEvent], []);
    const after = Date.now();
    expect(result[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(result[0].timestamp).toBeLessThanOrEqual(after);
  });
});

describe('classifyDiscrepancySeverity', () => {
  it('returns critical for credit_mismatch', () => {
    expect(classifyDiscrepancySeverity('credit_mismatch')).toBe('critical');
  });

  it('returns critical for gateway_discrepancy', () => {
    expect(classifyDiscrepancySeverity('gateway_discrepancy')).toBe('critical');
  });

  it('returns high for missing_in_db', () => {
    expect(classifyDiscrepancySeverity('missing_in_db')).toBe('high');
  });

  it('returns medium for missing_in_kv', () => {
    expect(classifyDiscrepancySeverity('missing_in_kv')).toBe('medium');
  });

  it('returns low for unknown type', () => {
    expect(classifyDiscrepancySeverity('unknown' as never)).toBe('low');
  });

  it('returns critical when affects billing and amount > 100', () => {
    const result = classifyDiscrepancySeverity('missing_in_kv', {
      affectsBilling: true,
      amount: 200,
    });
    expect(result).toBe('critical');
  });

  it('returns high for recurring issues', () => {
    const result = classifyDiscrepancySeverity('missing_in_kv', {
      isRecurring: true,
    });
    expect(result).toBe('high');
  });

  it('returns high for amount > 50', () => {
    const result = classifyDiscrepancySeverity('missing_in_kv', {
      amount: 75,
    });
    expect(result).toBe('high');
  });
});

describe('filterDiscrepanciesBySeverity', () => {
  const discrepancies = [
    { type: 'missing_in_kv' as const, severity: 'low' as const, licenseNonce: 'a', userId: 'u', details: { description: 'test', source: 'test' }, timestamp: 1, eventId: 'e1' },
    { type: 'missing_in_kv' as const, severity: 'medium' as const, licenseNonce: 'b', userId: 'u', details: { description: 'test', source: 'test' }, timestamp: 2, eventId: 'e2' },
    { type: 'missing_in_kv' as const, severity: 'high' as const, licenseNonce: 'c', userId: 'u', details: { description: 'test', source: 'test' }, timestamp: 3, eventId: 'e3' },
    { type: 'credit_mismatch' as const, severity: 'critical' as const, licenseNonce: 'd', userId: 'u', details: { description: 'test', source: 'test' }, timestamp: 4, eventId: 'e4' },
  ];

  it('filters by minimum severity', () => {
    const result = filterDiscrepanciesBySeverity(discrepancies, 'high');
    expect(result).toHaveLength(2);
    expect(result[0].severity).toBe('high');
    expect(result[1].severity).toBe('critical');
  });

  it('returns all when min severity is low', () => {
    const result = filterDiscrepanciesBySeverity(discrepancies, 'low');
    expect(result).toHaveLength(4);
  });

  it('returns only critical when min severity is critical', () => {
    const result = filterDiscrepanciesBySeverity(discrepancies, 'critical');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });

  it('returns empty array when none match', () => {
    const mild = discrepancies.filter(d => d.severity === 'low');
    const result = filterDiscrepanciesBySeverity(mild, 'high');
    expect(result).toHaveLength(0);
  });
});
