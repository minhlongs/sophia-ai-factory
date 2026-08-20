/**
 * Performance Aggregation Tests — Phase 4: Creative Learning Loop
 *
 * Tests the pure helper functions exported from
 * forest/inngest/functions/performance-aggregation.ts:
 *   - mergeMetrics(events) — averages numeric metrics across events
 *   - AGGREGATION_WINDOW_MS / HIGH_CONFIDENCE_THRESHOLD constants
 *
 * The Inngest function itself is not directly testable (it requires a
 * live Inngest client + D1 binding), so we test the exported helpers
 * that contain the core aggregation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  AGGREGATION_WINDOW_MS,
  HIGH_CONFIDENCE_THRESHOLD,
  mergeMetrics,
} from '../performance-aggregation';

// ─── Constants ──────────────────────────────────────────────────────────────

describe('performance-aggregation constants', () => {
  it('AGGREGATION_WINDOW_MS is 24 hours in ms', () => {
    expect(AGGREGATION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('HIGH_CONFIDENCE_THRESHOLD is 10 events', () => {
    expect(HIGH_CONFIDENCE_THRESHOLD).toBe(10);
  });
});

// ─── mergeMetrics ───────────────────────────────────────────────────────────

describe('mergeMetrics', () => {
  it('returns empty object when given no events', () => {
    expect(mergeMetrics([])).toEqual({});
  });

  it('averages a single numeric metric across events', () => {
    const events = [
      { metrics_json: JSON.stringify({ views: 100 }) },
      { metrics_json: JSON.stringify({ views: 200 }) },
      { metrics_json: JSON.stringify({ views: 300 }) },
    ];
    const result = mergeMetrics(events);
    expect(result.views).toBe(200);
  });

  it('averages multiple distinct metrics independently', () => {
    const events = [
      { metrics_json: JSON.stringify({ views: 100, clicks: 10 }) },
      { metrics_json: JSON.stringify({ views: 200, clicks: 20 }) },
    ];
    const result = mergeMetrics(events);
    expect(result.views).toBe(150);
    expect(result.clicks).toBe(15);
  });

  it('ignores non-numeric metric values', () => {
    const events = [
      { metrics_json: JSON.stringify({ views: 100, label: 'hello' }) },
      { metrics_json: JSON.stringify({ views: 200, label: 'world' }) },
    ];
    const result = mergeMetrics(events);
    expect(result.views).toBe(150);
    expect(result).not.toHaveProperty('label');
  });

  it('skips events with malformed JSON', () => {
    const events = [
      { metrics_json: 'not-json{' },
      { metrics_json: JSON.stringify({ views: 100 }) },
    ];
    const result = mergeMetrics(events);
    expect(result.views).toBe(100);
  });

  it('skips events with no numeric metrics', () => {
    const events = [
      { metrics_json: JSON.stringify({ label: 'no numbers' }) },
      { metrics_json: JSON.stringify({ views: 50 }) },
    ];
    const result = mergeMetrics(events);
    expect(result.views).toBe(50);
  });
});