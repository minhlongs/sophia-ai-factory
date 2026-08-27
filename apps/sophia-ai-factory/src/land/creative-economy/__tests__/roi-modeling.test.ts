/**
 * Unit tests: roi-modeling.ts pure math — zero-cost guard, division safety,
 * ms window boundaries, and deterministic aggregation ordering.
 * No DB, no mocks — pure functions only.
 *
 * @module land/creative-economy/__tests__/roi-modeling
 */

import { describe, it, expect } from 'vitest';
import {
  computeRoi,
  aggregateRoiByEntity,
  windowBoundsMs,
  inWindowMs,
  REVENUE_EVENT_TYPES,
  COST_EVENT_TYPE,
  type PerfEventLike,
} from '../roi-modeling';

describe('computeRoi', () => {
  it('returns null when cost is zero (never Infinity)', () => {
    expect(computeRoi(1000, 0)).toBeNull();
  });

  it('returns null when cost is negative', () => {
    expect(computeRoi(1000, -5)).toBeNull();
  });

  it('returns null for non-finite inputs', () => {
    expect(computeRoi(Number.POSITIVE_INFINITY, 100)).toBeNull();
    expect(computeRoi(100, Number.NaN)).toBeNull();
  });

  it('computes positive ROI rounded to 2 decimals', () => {
    // (3000 - 1000) / 1000 * 100 = 200
    expect(computeRoi(3000, 1000)).toBe(200);
  });

  it('computes negative ROI when revenue < cost', () => {
    // (500 - 1000) / 1000 * 100 = -50
    expect(computeRoi(500, 1000)).toBe(-50);
  });

  it('returns -100 when revenue is zero and cost is positive', () => {
    expect(computeRoi(0, 1000)).toBe(-100);
  });

  it('rounds fractional ROI to 2 decimals', () => {
    // (1000 - 300) / 300 * 100 = 233.333... → 233.33
    expect(computeRoi(1000, 300)).toBe(233.33);
  });
});

describe('windowBoundsMs', () => {
  it('computes an inclusive ms window ending at nowMs', () => {
    const nowMs = 1_000_000_000_000;
    const { startMs, endMs } = windowBoundsMs(nowMs, 30);
    expect(endMs).toBe(nowMs);
    expect(startMs).toBe(nowMs - 30 * 24 * 60 * 60 * 1000);
  });
});

describe('inWindowMs', () => {
  it('is inclusive at both bounds', () => {
    expect(inWindowMs(100, 100, 200)).toBe(true);
    expect(inWindowMs(200, 100, 200)).toBe(true);
  });

  it('rejects values outside the window', () => {
    expect(inWindowMs(99, 100, 200)).toBe(false);
    expect(inWindowMs(201, 100, 200)).toBe(false);
  });
});

describe('aggregateRoiByEntity', () => {
  const ev = (
    entityId: string,
    eventType: string,
    valueCents: number,
    channel: string | null = 'youtube',
    entityType = 'asset',
  ): PerfEventLike => ({ entityType, entityId, channel, eventType, valueCents });

  it('sums revenue event types and cost separately per entity', () => {
    const rows = [
      ev('a1', 'revenue', 1000),
      ev('a1', 'sponsorship', 500),
      ev('a1', 'conversion', 250),
      ev('a1', COST_EVENT_TYPE, 800),
    ];
    const result = aggregateRoiByEntity(rows);
    expect(result).toHaveLength(1);
    expect(result[0].revenueCents).toBe(1750);
    expect(result[0].costCents).toBe(800);
    // (1750 - 800) / 800 * 100 = 118.75
    expect(result[0].roiPct).toBe(118.75);
  });

  it('ignores event types outside the revenue set and cost', () => {
    const rows = [ev('a1', 'impression', 999), ev('a1', 'click', 123)];
    const result = aggregateRoiByEntity(rows);
    expect(result).toHaveLength(1);
    expect(result[0].revenueCents).toBe(0);
    expect(result[0].costCents).toBe(0);
    expect(result[0].roiPct).toBeNull();
  });

  it('maps null channel to "unknown"', () => {
    const rows = [ev('a1', 'revenue', 100, null)];
    const result = aggregateRoiByEntity(rows);
    expect(result[0].channel).toBe('unknown');
  });

  it('keeps distinct (entityType, entityId, channel) groups separate', () => {
    const rows = [
      ev('a1', 'revenue', 100, 'youtube'),
      ev('a1', 'revenue', 200, 'tiktok'),
      ev('a2', 'revenue', 300, 'youtube'),
    ];
    const result = aggregateRoiByEntity(rows);
    expect(result).toHaveLength(3);
  });

  it('orders by roiPct desc with nulls last', () => {
    const rows = [
      ev('low', 'revenue', 100),
      ev('low', COST_EVENT_TYPE, 1000), // roi -90
      ev('high', 'revenue', 5000),
      ev('high', COST_EVENT_TYPE, 1000), // roi 400
      ev('nocost', 'revenue', 50), // roi null
    ];
    const result = aggregateRoiByEntity(rows);
    expect(result.map((r) => r.entityId)).toEqual(['high', 'low', 'nocost']);
  });

  it('breaks roiPct ties by revenueCents desc then entityId asc', () => {
    const rows = [
      ev('b', 'revenue', 200),
      ev('b', COST_EVENT_TYPE, 100), // roi 100, rev 200
      ev('a', 'revenue', 200),
      ev('a', COST_EVENT_TYPE, 100), // roi 100, rev 200
      ev('c', 'revenue', 400),
      ev('c', COST_EVENT_TYPE, 200), // roi 100, rev 400
    ];
    const result = aggregateRoiByEntity(rows);
    // all roi 100 → revenue desc: c(400), then a/b tie → entityId asc: a, b
    expect(result.map((r) => r.entityId)).toEqual(['c', 'a', 'b']);
  });

  it('exposes the exact revenue event types the producers write', () => {
    expect(REVENUE_EVENT_TYPES).toEqual(['revenue', 'sponsorship', 'conversion']);
    expect(COST_EVENT_TYPE).toBe('mission_completed');
  });
});
