import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateLicenseTotals,
  buildTrendPoints,
  parsePeriodLabel,
  resolveTimestamps,
} from './ceo-revenue-aggregators';

const DAY = 86_400;

describe('parsePeriodLabel', () => {
  it.each([
    ['Current month', 'current_month'],
    ['THIS MONTH', 'current_month'],
    ['tháng này', 'current_month'],
    ['hiện tại', 'current_month'],
    ['last month', 'last_month'],
    ['tháng trước', 'last_month'],
    ['last 7 days', 'last_7_days'],
    ['7 day period', 'last_7_days'],
    ['tuần này', 'last_7_days'],
    ['previous quarter', 'last_30_days'],
  ] as const)('maps "%s" to %s', (input, expected) => {
    expect(parsePeriodLabel(input)).toBe(expected);
  });
});

describe('resolveTimestamps', () => {
  afterEach(() => vi.useRealTimers());

  it('uses month boundaries in the current calendar month, including leap-year February', () => {
    const now = new Date(2024, 1, 29, 12).getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(resolveTimestamps('current_month', now)).toEqual({
      startTimestamp: Math.floor(new Date(2024, 1, 1).getTime() / 1000),
      endTimestamp: Math.floor(now / 1000),
    });
    expect(resolveTimestamps('last_month', now)).toEqual({
      startTimestamp: Math.floor(new Date(2024, 0, 1).getTime() / 1000),
      endTimestamp: Math.floor(new Date(2024, 1, 0).getTime() / 1000),
    });
  });

  it.each([
    ['last_7_days', 7],
    ['last_30_days', 30],
  ] as const)('subtracts the exact elapsed duration for %s', (period, days) => {
    const now = 1_700_000_000_123;
    expect(resolveTimestamps(period, now)).toEqual({
      startTimestamp: Math.floor(now / 1000) - days * DAY,
      endTimestamp: Math.floor(now / 1000),
    });
  });
});

describe('aggregateLicenseTotals', () => {
  it('separates recurring and one-time revenue and groups customers by tier', () => {
    expect(aggregateLicenseTotals([
      { tier: 'PREMIUM', metadata: { amount: '1200', recurring: true } },
      { tier: 'PREMIUM', metadata: { amount: 300, recurring: false } },
      { tier: 'MASTER', metadata: { amount: 500 } },
      { metadata: null },
    ])).toEqual({
      totalRevenue: 2_000,
      recurringRevenue: 1_200,
      oneTimeRevenue: 800,
      byTier: [
        { tier: 'PREMIUM', customers: 2, revenue: 1_500 },
        { tier: 'MASTER', customers: 1, revenue: 500 },
        { tier: 'unknown', customers: 1, revenue: 0 },
      ],
    });
  });

  it('returns zero totals and no tiers for an empty license list', () => {
    expect(aggregateLicenseTotals([])).toEqual({
      totalRevenue: 0,
      recurringRevenue: 0,
      oneTimeRevenue: 0,
      byTier: [],
    });
  });
});

describe('buildTrendPoints', () => {
  const start = Math.floor(Date.UTC(2025, 0, 1) / 1000);

  it('creates daily buckets for a seven-day window and excludes the end boundary', () => {
    const points = buildTrendPoints([
      { created_at: start, metadata: { amount: 10 } },
      { created_at: start + 6 * DAY + 1, metadata: { amount: 7 } },
      { created_at: start + 7 * DAY, metadata: { amount: 99 } },
      { created_at: start - 1, metadata: { amount: 99 } },
    ], start, start + 7 * DAY);

    expect(points).toHaveLength(7);
    expect(points[0]).toEqual({ date: '2025-01-01', revenue: 10 });
    expect(points[6]?.revenue).toBe(7);
  });

  it('uses seven-day buckets for windows up to 31 days, including a partial final bucket', () => {
    const points = buildTrendPoints([
      { created_at: start + 6 * DAY, metadata: { amount: 6 } },
      { created_at: start + 7 * DAY, metadata: { amount: 7 } },
      { created_at: start + 14 * DAY, metadata: { amount: 14 } },
      { created_at: start + 15 * DAY, metadata: { amount: 100 } },
    ], start, start + 15 * DAY);

    expect(points.map(({ revenue }) => revenue)).toEqual([6, 7, 14]);
  });

  it('uses monthly buckets for windows longer than 31 days and handles empty windows', () => {
    const points = buildTrendPoints([
      { created_at: start + 29 * DAY, metadata: { amount: 30 } },
      { created_at: start + 30 * DAY, metadata: { amount: 31 } },
      { created_at: start + 60 * DAY, metadata: { amount: 100 } },
    ], start, start + 60 * DAY);

    expect(points.map(({ revenue }) => revenue)).toEqual([30, 31]);
    expect(buildTrendPoints([], start, start)).toEqual([]);
  });
});
