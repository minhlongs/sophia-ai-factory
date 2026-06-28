/**
 * Tests for video render benchmark aggregator — P27.
 */

import { describe, it, expect } from 'vitest'
import { summariseBenchmarkRows } from './video-render-benchmark'

describe('summariseBenchmarkRows', () => {
  it('returns null durations + low_confidence for empty input', () => {
    const summary = summariseBenchmarkRows([])
    expect(summary.sample_size).toBe(0)
    expect(summary.durations_seconds).toBeNull()
    expect(summary.low_confidence).toBe(true)
    expect(summary.percent_under_promise).toBeNull()
  })

  it('marks low_confidence when sample_size < 10', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ duration_seconds: (i + 1) * 60 }))
    const summary = summariseBenchmarkRows(rows)
    expect(summary.sample_size).toBe(5)
    expect(summary.low_confidence).toBe(true)
    expect(summary.durations_seconds?.min).toBe(60)
    expect(summary.durations_seconds?.max).toBe(300)
  })

  it('clears low_confidence at >=10 samples', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ duration_seconds: (i + 1) * 30 }))
    const summary = summariseBenchmarkRows(rows)
    expect(summary.low_confidence).toBe(false)
  })

  it('computes p50/p95/p99 in sorted order', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((d) => ({ duration_seconds: d }))
    const summary = summariseBenchmarkRows(rows)
    expect(summary.durations_seconds?.min).toBe(10)
    expect(summary.durations_seconds?.max).toBe(100)
    expect(summary.durations_seconds?.p50).toBe(60)
    expect(summary.durations_seconds?.p95).toBe(100)
    expect(summary.durations_seconds?.p99).toBe(100)
    expect(summary.durations_seconds?.avg).toBe(55)
  })

  it('computes percent_under_promise against 40min threshold', () => {
    const rows = [
      { duration_seconds: 600 },   // 10 min under
      { duration_seconds: 1200 },  // 20 min under
      { duration_seconds: 2400 },  // exactly 40 min — counted as under (<=)
      { duration_seconds: 3000 },  // over
      { duration_seconds: 3600 },  // over
    ]
    const summary = summariseBenchmarkRows(rows)
    expect(summary.promise_threshold_seconds).toBe(2400)
    expect(summary.percent_under_promise).toBe(60)
  })

  it('preserves window + tier filter metadata', () => {
    const summary = summariseBenchmarkRows([{ duration_seconds: 100 }], {
      windowSeconds: 86400,
      tier: 'PREMIUM',
    })
    expect(summary.window_seconds).toBe(86400)
    expect(summary.tier).toBe('PREMIUM')
  })

  it('handles single sample without overflow', () => {
    const summary = summariseBenchmarkRows([{ duration_seconds: 1800 }])
    expect(summary.sample_size).toBe(1)
    expect(summary.durations_seconds?.p50).toBe(1800)
    expect(summary.durations_seconds?.avg).toBe(1800)
    expect(summary.percent_under_promise).toBe(100)
  })
})
