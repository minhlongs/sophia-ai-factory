import { describe, expect, it, vi } from 'vitest';
import type { D1QueryChain } from '@/seed/db/d1-query-chain';
import { aggregateViolationSummary, applyViolationFilters, mapViolationRowToEvent } from './violation-query-helpers';
import type { ViolationRow } from './violation-query-helpers';

function row(overrides: Partial<ViolationRow> = {}): ViolationRow {
  return {
    id: 'violation-1',
    type: 'quota_exceeded',
    severity: 'high',
    user_id: 'user-1',
    license_nonce: 'nonce-1',
    tier: 'PREMIUM',
    endpoint: '/api/generate',
    ip_address: '203.0.113.1',
    user_agent: 'test-agent',
    metadata: { reason: 'limit', count: 3 },
    created_at: '1760000000',
    resolved: false,
    resolved_at: undefined,
    ...overrides,
  };
}

describe('applyViolationFilters', () => {
  it('applies every supplied filter and returns the final query chain', () => {
    const calls: Array<[string, string, unknown]> = [];
    const query = {
      eq: vi.fn((column: string, value: unknown) => { calls.push(['eq', column, value]); return query; }),
      gte: vi.fn((column: string, value: unknown) => { calls.push(['gte', column, value]); return query; }),
      lte: vi.fn((column: string, value: unknown) => { calls.push(['lte', column, value]); return query; }),
    } as unknown as D1QueryChain;

    const result = applyViolationFilters(query, {
      licenseNonce: 'nonce-1', userId: 'user-1', type: 'quota_exceeded', severity: 'critical',
      startTimestamp: 100, endTimestamp: 200, resolved: false,
    });

    expect(result).toBe(query);
    expect(calls).toEqual([
      ['eq', 'license_nonce', 'nonce-1'], ['eq', 'user_id', 'user-1'],
      ['eq', 'type', 'quota_exceeded'], ['eq', 'severity', 'critical'],
      ['gte', 'created_at', 100], ['lte', 'created_at', 200], ['eq', 'resolved', false],
    ]);
  });

  it('skips absent and zero-valued filters but preserves explicit false resolved state', () => {
    const eq = vi.fn(() => query);
    const gte = vi.fn(() => query);
    const lte = vi.fn(() => query);
    const query = { eq, gte, lte } as unknown as D1QueryChain;
    expect(applyViolationFilters(query, { startTimestamp: 0, endTimestamp: 0, resolved: false })).toBe(query);
    expect(eq).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith('resolved', false);
    expect(gte).not.toHaveBeenCalled();
    expect(lte).not.toHaveBeenCalled();
  });
});

describe('mapViolationRowToEvent', () => {
  it('maps numeric strings and omits nullable optional fields', () => {
    expect(mapViolationRowToEvent(row({
      ip_address: null, user_agent: null, metadata: null, resolved_at: '1760000100',
    }))).toEqual({
      id: 'violation-1', type: 'quota_exceeded', severity: 'high', userId: 'user-1',
      licenseNonce: 'nonce-1', tier: 'PREMIUM', endpoint: '/api/generate',
      createdAt: 1_760_000_000, resolved: false, resolvedAt: 1_760_000_100,
    });
  });

  it('preserves numeric timestamps and optional data when present', () => {
    expect(mapViolationRowToEvent(row({ created_at: 123 as unknown as string, resolved_at: undefined }))).toMatchObject({
      createdAt: 123, ipAddress: '203.0.113.1', userAgent: 'test-agent', metadata: { reason: 'limit', count: 3 },
    });
    expect(mapViolationRowToEvent(row({ resolved_at: undefined })).resolvedAt).toBeUndefined();
  });
});

describe('aggregateViolationSummary', () => {
  it.each([null, []])('returns zeroed summary for empty input', (input) => {
    expect(aggregateViolationSummary(input)).toEqual({
      totalViolations: 0, byType: {}, bySeverity: {}, byTier: {},
      resolvedCount: 0, unresolvedCount: 0, trend: [],
    });
  });

  it('aggregates categories and orders daily trend chronologically', () => {
    const summary = aggregateViolationSummary([
      row({ created_at: '1760000000', resolved: true }),
      row({ id: 'violation-2', type: 'invalid_license', severity: 'critical', tier: 'BASIC', created_at: '1760086400', resolved: false }),
      row({ id: 'violation-3', created_at: 1760000000 as unknown as string, resolved: true }),
    ]);

    expect(summary).toMatchObject({
      totalViolations: 3,
      byType: { quota_exceeded: 2, invalid_license: 1 },
      bySeverity: { high: 2, critical: 1 },
      byTier: { PREMIUM: 2, BASIC: 1 },
      resolvedCount: 2,
      unresolvedCount: 1,
    });
    expect(summary.trend).toEqual([
      { date: '2025-10-09', count: 2 },
      { date: '2025-10-10', count: 1 },
    ]);
  });
});
