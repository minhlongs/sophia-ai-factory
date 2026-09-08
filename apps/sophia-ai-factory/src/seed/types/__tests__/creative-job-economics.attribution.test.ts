/**
 * Unit tests for attribution + gross-margin pure functions
 * (SUPREME COMMAND #10 — Phase 7, tests 1-7, 13).
 *
 * @module seed/types/__tests__/creative-job-economics.attribution
 */

import { describe, it, expect } from 'vitest';
import {
  computeGrossMargin,
  isWithinWindow,
  selectLastTouch,
  AttributionFailureKind,
  type AttributionCandidate,
  type AttributionWindow,
} from '../creative-job-economics';

const DAY_MS = 86400 * 1000;

function candidate(recordedAt: number, valueCents = 1000): AttributionCandidate {
  return {
    sourceEventId: `evt_${recordedAt}`,
    sourceType: 'revenue',
    channel: 'youtube',
    valueCents,
    recordedAt,
  };
}

describe('isWithinWindow', () => {
  const window: AttributionWindow = { jobCompletedAt: 1000 * DAY_MS, windowDays: 30 };

  it('test 1 — candidate inside window returns true', () => {
    // 10 days after job completion — within 30-day window.
    const c = candidate(1000 * DAY_MS + 10 * DAY_MS);
    expect(isWithinWindow(c, window)).toBe(true);
  });

  it('test 2 — candidate after window returns false', () => {
    // 31 days after job completion — outside 30-day window.
    const c = candidate(1000 * DAY_MS + 31 * DAY_MS);
    expect(isWithinWindow(c, window)).toBe(false);
  });

  it('test 3 — candidate before job completion returns false', () => {
    // 5 days BEFORE job completion — must not attribute backward.
    const c = candidate(1000 * DAY_MS - 5 * DAY_MS);
    expect(isWithinWindow(c, window)).toBe(false);
  });
});

describe('selectLastTouch', () => {
  const window: AttributionWindow = { jobCompletedAt: 1000 * DAY_MS, windowDays: 30 };

  it('test 4 — picks most recent of 3 candidates', () => {
    const candidates = [
      candidate(1000 * DAY_MS + 2 * DAY_MS, 500),
      candidate(1000 * DAY_MS + 20 * DAY_MS, 700),
      candidate(1000 * DAY_MS + 10 * DAY_MS, 600),
    ];
    const winner = selectLastTouch(candidates, window);
    expect(winner).not.toBeNull();
    expect(winner?.sourceEventId).toBe(`evt_${1000 * DAY_MS + 20 * DAY_MS}`);
    expect(winner?.valueCents).toBe(700);
  });

  it('test 5 — returns null when none in window', () => {
    const candidates = [
      candidate(1000 * DAY_MS - 10 * DAY_MS), // before
      candidate(1000 * DAY_MS + 40 * DAY_MS), // after
    ];
    expect(selectLastTouch(candidates, window)).toBeNull();
  });
});

describe('computeGrossMargin', () => {
  it('test 6 — both known → correct percentage', () => {
    // ((1000 - 250) / 1000) * 100 = 75
    expect(computeGrossMargin(250, 1000)).toBe(75);
  });

  it('test 7 — revenue null → null', () => {
    expect(computeGrossMargin(250, null)).toBeNull();
  });

  it('test 7b — cost null → null', () => {
    expect(computeGrossMargin(null, 1000)).toBeNull();
  });

  it('test 7c — revenue zero → null (div-by-zero guard)', () => {
    expect(computeGrossMargin(250, 0)).toBeNull();
  });
});

describe('AttributionFailureKind taxonomy', () => {
  it('test 13 — provenance contains no PII fields', () => {
    // The failure taxonomy is INTERNAL only — verify it classifies
    // attribution failures without referencing customer PII.
    const kinds = Object.values(AttributionFailureKind);
    expect(kinds).toHaveLength(5);
    expect(kinds).toContain('NO_CANDIDATE_JOB');
    expect(kinds).toContain('ATTRIBUTION_WINDOW_EXPIRED');
    expect(kinds).toContain('MULTIPLE_CANDIDATES');
    expect(kinds).toContain('WORKSPACE_UNRESOLVED');
    expect(kinds).toContain('EVENT_ALREADY_OWNED');

    // No PII-bearing values (no names, emails, tokens).
    for (const k of kinds) {
      expect(k).not.toMatch(/email|name|token|password|pii/i);
    }
  });
});
