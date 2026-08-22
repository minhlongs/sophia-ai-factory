/**
 * Tests for content-calendar-logic — pure cadence / scheduling / buffer logic.
 * No DB access — fully deterministic.
 *
 * @module land/youtube/__tests__/content-calendar-logic
 */

import { describe, it, expect } from 'vitest';
import {
  shouldGenerateContentToday,
  nextScheduledAt,
  isWithinBufferHorizon,
  type FrequencyCheckInput,
} from '../content-calendar-logic';

// ── shouldGenerateContentToday ──────────────────────────────────────────────

describe('shouldGenerateContentToday — buffer gate', () => {
  const base = (over: Partial<FrequencyCheckInput> = {}): FrequencyCheckInput => ({
    userId: 'u-1',
    channelConfigId: 'cc-1',
    cadence: 'weekly',
    postsPerWeek: 1,
    bufferDays: 3,
    upcomingCount: 0,
    postsLast7Days: 0,
    lastPostAt: null,
    now: new Date('2026-08-22T00:00:00Z'),
    ...over,
  });

  it('skips when upcoming count meets the buffer horizon', () => {
    const result = shouldGenerateContentToday(base({ upcomingCount: 3, bufferDays: 3 }));
    expect(result.shouldGenerate).toBe(false);
    expect(result.reason).toContain('Content buffer sufficient');
  });

  it('skips when upcoming count exceeds the buffer horizon', () => {
    const result = shouldGenerateContentToday(base({ upcomingCount: 5, bufferDays: 3 }));
    expect(result.shouldGenerate).toBe(false);
  });

  it('allows generation when upcoming count is below the buffer horizon', () => {
    const result = shouldGenerateContentToday(base({ upcomingCount: 2, bufferDays: 3 }));
    expect(result.shouldGenerate).toBe(true);
  });

  it('passes the buffer gate when bufferDays is 0', () => {
    const result = shouldGenerateContentToday(base({ bufferDays: 0, upcomingCount: 99 }));
    expect(result.shouldGenerate).toBe(true);
  });
});

describe('shouldGenerateContentToday — cadence gap gate', () => {
  const base = (over: Partial<FrequencyCheckInput> = {}): FrequencyCheckInput => ({
    userId: 'u-1',
    channelConfigId: 'cc-1',
    cadence: 'every-2-days',
    postsPerWeek: 3,
    bufferDays: 0,
    upcomingCount: 0,
    postsLast7Days: 0,
    lastPostAt: '2026-08-21T00:00:00Z',
    now: new Date('2026-08-22T00:00:00Z'),
    ...over,
  });

  it('skips when last post was 1 day ago for a 2-day gap cadence', () => {
    const result = shouldGenerateContentToday(base());
    expect(result.shouldGenerate).toBe(false);
    expect(result.reason).toContain('Cadence every-2-days');
  });

  it('allows generation when last post was 2 days ago (gap met)', () => {
    const result = shouldGenerateContentToday(
      base({ lastPostAt: '2026-08-20T00:00:00Z' }),
    );
    expect(result.shouldGenerate).toBe(true);
  });

  it('allows generation when last post was 3 days ago (gap exceeded)', () => {
    const result = shouldGenerateContentToday(
      base({ lastPostAt: '2026-08-19T00:00:00Z' }),
    );
    expect(result.shouldGenerate).toBe(true);
  });

  it('skips gap gate for non-gap cadences (daily)', () => {
    const result = shouldGenerateContentToday(
      base({
        cadence: 'daily',
        lastPostAt: '2026-08-21T23:00:00Z',
        now: new Date('2026-08-22T00:00:00Z'),
      }),
    );
    expect(result.shouldGenerate).toBe(true);
  });

  it('skips gap gate when lastPostAt is null', () => {
    const result = shouldGenerateContentToday(base({ lastPostAt: null }));
    expect(result.shouldGenerate).toBe(true);
  });

  it('ignores an invalid lastPostAt date', () => {
    const result = shouldGenerateContentToday(base({ lastPostAt: 'not-a-date' }));
    expect(result.shouldGenerate).toBe(true);
  });
});

describe('shouldGenerateContentToday — weekly cap gate', () => {
  const base = (over: Partial<FrequencyCheckInput> = {}): FrequencyCheckInput => ({
    userId: 'u-1',
    channelConfigId: 'cc-1',
    cadence: 'weekly',
    postsPerWeek: 1,
    bufferDays: 0,
    upcomingCount: 0,
    postsLast7Days: 0,
    lastPostAt: null,
    now: new Date('2026-08-22T00:00:00Z'),
    ...over,
  });

  it('skips when the weekly cap is reached', () => {
    const result = shouldGenerateContentToday(base({ postsLast7Days: 1, postsPerWeek: 1 }));
    expect(result.shouldGenerate).toBe(false);
    expect(result.reason).toContain('Weekly cap reached');
  });

  it('skips when posts in trailing 7 days exceed the cap', () => {
    const result = shouldGenerateContentToday(base({ postsLast7Days: 5, postsPerWeek: 3 }));
    expect(result.shouldGenerate).toBe(false);
  });

  it('allows generation when under the weekly cap', () => {
    const result = shouldGenerateContentToday(base({ postsLast7Days: 0, postsPerWeek: 3 }));
    expect(result.shouldGenerate).toBe(true);
  });

  it('falls back to the cadence-implied cap when postsPerWeek is unset', () => {
    const result = shouldGenerateContentToday(
      base({ postsPerWeek: 0, cadence: 'weekly', postsLast7Days: 1 }),
    );
    expect(result.shouldGenerate).toBe(false);
  });

  it('uses the cadence-implied cap for daily (7)', () => {
    const result = shouldGenerateContentToday(
      base({ postsPerWeek: 0, cadence: 'daily', postsLast7Days: 7 }),
    );
    expect(result.shouldGenerate).toBe(false);
  });

  it('uses the cadence-implied cap for every-2-days (3)', () => {
    const result = shouldGenerateContentToday(
      base({ postsPerWeek: 0, cadence: 'every-2-days', postsLast7Days: 3 }),
    );
    expect(result.shouldGenerate).toBe(false);
  });

  it('uses the cadence-implied cap for 3-per-week (3)', () => {
    const result = shouldGenerateContentToday(
      base({ postsPerWeek: 0, cadence: '3-per-week', postsLast7Days: 3 }),
    );
    expect(result.shouldGenerate).toBe(false);
  });

  it('enforces a minimum cap of 1 even with postsPerWeek 0 and unknown cadence', () => {
    // cadence 'weekly' implies cap 1; with 0 posts already it should pass.
    const result = shouldGenerateContentToday(
      base({ postsPerWeek: 0, cadence: 'weekly', postsLast7Days: 0 }),
    );
    expect(result.shouldGenerate).toBe(true);
  });
});

describe('shouldGenerateContentToday — gate precedence', () => {
  it('buffer gate wins over weekly cap', () => {
    const result = shouldGenerateContentToday({
      userId: 'u-1',
      channelConfigId: 'cc-1',
      cadence: 'weekly',
      postsPerWeek: 1,
      bufferDays: 2,
      upcomingCount: 2,
      postsLast7Days: 0,
      lastPostAt: null,
      now: new Date('2026-08-22T00:00:00Z'),
    });
    expect(result.shouldGenerate).toBe(false);
    expect(result.reason).toContain('Content buffer sufficient');
  });
});

// ── nextScheduledAt ─────────────────────────────────────────────────────────

describe('nextScheduledAt', () => {
  it('schedules 1 post/week roughly 7 days out', () => {
    const now = new Date('2026-08-22T00:00:00Z');
    const result = nextScheduledAt(1, now);
    const scheduled = new Date(result);
    const diffDays = (scheduled.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it('schedules 3 posts/week roughly 2.33 days out', () => {
    const now = new Date('2026-08-22T00:00:00Z');
    const result = nextScheduledAt(3, now);
    const scheduled = new Date(result);
    const diffDays = (scheduled.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(2.2);
    expect(diffDays).toBeLessThan(2.5);
  });

  it('enforces a minimum of 1 post per week', () => {
    const now = new Date('2026-08-22T00:00:00Z');
    const result = nextScheduledAt(0, now);
    const scheduled = new Date(result);
    const diffDays = (scheduled.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it('returns a valid ISO string in the future', () => {
    const result = nextScheduledAt(2);
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});

// ── isWithinBufferHorizon ────────────────────────────────────────────────────

describe('isWithinBufferHorizon', () => {
  const now = new Date('2026-08-22T00:00:00Z');

  it('returns true when scheduledAt is today', () => {
    expect(isWithinBufferHorizon('2026-08-22T12:00:00Z', 3, now)).toBe(true);
  });

  it('returns true when scheduledAt is within the buffer horizon', () => {
    expect(isWithinBufferHorizon('2026-08-24T00:00:00Z', 3, now)).toBe(true);
  });

  it('returns false when scheduledAt is past the buffer horizon', () => {
    expect(isWithinBufferHorizon('2026-08-26T00:00:00Z', 3, now)).toBe(false);
  });

  it('returns false when scheduledAt is in the past', () => {
    expect(isWithinBufferHorizon('2026-08-21T00:00:00Z', 3, now)).toBe(false);
  });

  it('returns false for an invalid date string', () => {
    expect(isWithinBufferHorizon('not-a-date', 3, now)).toBe(false);
  });

  it('returns true when bufferDays is 0 and scheduledAt is now', () => {
    expect(isWithinBufferHorizon('2026-08-22T00:00:00Z', 0, now)).toBe(true);
  });

  it('returns false when bufferDays is 0 and scheduledAt is in the future', () => {
    expect(isWithinBufferHorizon('2026-08-23T00:00:00Z', 0, now)).toBe(false);
  });
});