import { describe, expect, it, vi } from 'vitest';
import { buildOverageSummaryResponse, parseOverageQueryParams } from './overage-summary-helpers';
import type { OverageEventRow } from '@/tree/database/supabase-types';

function event(overrides: Partial<OverageEventRow> = {}): OverageEventRow {
  return {
    id: 'event-1',
    user_id: 'user-1',
    license_nonce: 'nonce-123456789',
    exceeded_type: 'daily_credits',
    exceeded_limit: 100,
    exceeded_current: 125,
    exceeded_by: 25,
    requested_credits: 25,
    endpoint: null,
    service_name: null,
    action: null,
    tier_at_exceeded: 'PREMIUM',
    external_customer_id: null,
    billable: true,
    ip_address: null,
    user_agent: null,
    created_at: 1_700_000_000,
    ...overrides,
  };
}

describe('parseOverageQueryParams', () => {
  it('parses custom bounds and optional filters', () => {
    const params = new URLSearchParams({ period: 'custom', start: '100', end: '250', tier: 'PREMIUM', limit: '7' });
    expect(parseOverageQueryParams(params)).toEqual({
      period: 'custom', startDate: 100, endDate: 250, tier: 'PREMIUM', limit: 7,
    });
  });

  it.each([
    ['day', 1], ['week', 7], ['month', 30], ['unknown', 1],
  ])('uses the expected rolling window for %s', (period, days) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00.000Z'));
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = parseOverageQueryParams(new URLSearchParams({ period }));
      expect(result.startDate).toBe(now - days * 86_400);
      expect(result.endDate).toBe(now);
      expect(result.limit).toBe(100);
      expect(result.tier).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('buildOverageSummaryResponse', () => {
  it('returns zeroed totals for a missing event result', () => {
    const range = { period: 'day', startDate: 10, endDate: 20, tier: null, limit: 100 };
    const result = buildOverageSummaryResponse(range, null);
    expect(result.period).toEqual({ type: 'day', startDate: 10, endDate: 20 });
    expect(result.summary).toMatchObject({
      totalEvents: 0, totalCreditsExceeded: 0, billableEvents: 0, billableCredits: 0,
      byType: {}, byTier: {}, topUsers: [],
    });
  });

  it('aggregates billable credits, unknown labels, user rankings, and caps returned events', () => {
    const rows = [
      event({
        user_id: null as unknown as string,
        exceeded_type: null as unknown as OverageEventRow['exceeded_type'],
        tier_at_exceeded: null as unknown as string,
        exceeded_by: null as unknown as number,
      }),
      event({ id: 'event-2', user_id: 'user-a', exceeded_by: 40, billable: false }),
      ...Array.from({ length: 20 }, (_, index) => event({
        id: `event-${index + 3}`,
        user_id: `user-${index}`,
        exceeded_by: index + 1,
        license_nonce: `nonce-${index}-abcdef`,
      })),
    ];
    const result = buildOverageSummaryResponse(
      { period: 'custom', startDate: 100, endDate: 200, tier: 'PREMIUM', limit: 50 },
      rows,
    );

    expect(result.summary.totalEvents).toBe(22);
    expect(result.summary.totalCreditsExceeded).toBe(250);
    expect(result.summary.billableEvents).toBe(21);
    expect(result.summary.billableCredits).toBe(210);
    expect(result.summary.byType).toEqual({ unknown: 1, daily_credits: 21 });
    expect(result.summary.byTier).toEqual({ UNKNOWN: 1, PREMIUM: 21 });
    expect(result.summary.topUsers).toHaveLength(10);
    expect(result.summary.topUsers[0]).toEqual({ userId: 'user-a', count: 1, credits: 40 });
    expect(result.summary.topUsers[1]).toEqual({ userId: 'user-19', count: 1, credits: 20 });
    expect(result.events).toHaveLength(20);
    expect(result.events?.[0]).toMatchObject({ id: 'event-1', licenseNonce: 'nonce-12...' });
  });
});
