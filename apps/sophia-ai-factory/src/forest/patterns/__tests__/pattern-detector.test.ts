/**
 * Unit tests for pattern-detector.ts
 *
 * Tests the heuristic confidence model and feature extraction helpers.
 * Pure functions only — no D1 dependency, so these run without a database.
 */

import { describe, it, expect } from 'vitest'
import {
  computeConfidence,
  extractFeature,
  bucketDuration,
  bucketPostingTime,
} from '../pattern-detector'

describe('computeConfidence', () => {
  it('returns 0 when sample size is below minimum', () => {
    expect(computeConfidence(4, 1)).toBe(0)
    expect(computeConfidence(0, 1)).toBe(0)
  })

  it('returns a positive value when consistency is 0 but sample is large (sample term alone)', () => {
    // Sample-size term saturates independently of consistency.
    // At n=50 with 0 consistency the score is sampleScore * 0.6.
    const c = computeConfidence(50, 0)
    expect(c).toBeGreaterThan(0)
    expect(c).toBeLessThan(computeConfidence(50, 1))
  })

  it('returns a value in (0, 1] for valid inputs', () => {
    const c = computeConfidence(50, 1)
    expect(c).toBeGreaterThan(0)
    expect(c).toBeLessThanOrEqual(1)
  })

  it('increases with sample size at fixed consistency', () => {
    const small = computeConfidence(10, 0.8)
    const large = computeConfidence(200, 0.8)
    expect(large).toBeGreaterThan(small)
  })

  it('increases with consistency at fixed sample size', () => {
    const low = computeConfidence(50, 0.2)
    const high = computeConfidence(50, 1)
    expect(high).toBeGreaterThan(low)
  })

  it('saturates — never exceeds 1 even with huge inputs', () => {
    expect(computeConfidence(10_000_000, 1)).toBeLessThanOrEqual(1)
  })
})

describe('bucketDuration', () => {
  it('buckets short videos correctly', () => {
    expect(bucketDuration('10')).toBe('0-15s')
    expect(bucketDuration('20')).toBe('16-30s')
    expect(bucketDuration('45')).toBe('31-60s')
    expect(bucketDuration('75')).toBe('61-90s')
    expect(bucketDuration('120')).toBe('90s+')
  })

  it('returns unknown for non-numeric input', () => {
    expect(bucketDuration('abc')).toBe('unknown')
    expect(bucketDuration('')).toBe('unknown')
  })
})

describe('bucketPostingTime', () => {
  it('classifies prime / shoulder / off-peak', () => {
    // 07:00 → prime (early morning)
    expect(bucketPostingTime('2026-08-19T07:00:00Z')).toBe('prime')
    // 12:00 → shoulder (workday)
    expect(bucketPostingTime('2026-08-19T12:00:00Z')).toBe('shoulder')
    // 19:00 → prime (evening)
    expect(bucketPostingTime('2026-08-19T19:00:00Z')).toBe('prime')
    // 02:00 → off-peak
    expect(bucketPostingTime('2026-08-19T02:00:00Z')).toBe('off-peak')
  })

  it('returns unknown for invalid date', () => {
    expect(bucketPostingTime('not-a-date')).toBe('unknown')
  })
})

describe('extractFeature', () => {
  it('returns the raw value for non-time features', () => {
    expect(extractFeature('hook_type', { hook_type: 'curiosity_gap' })).toBe('curiosity_gap')
    expect(extractFeature('channel', { channel: 'tiktok' })).toBe('tiktok')
  })

  it('returns unknown for missing values', () => {
    expect(extractFeature('hook_type', {})).toBe('unknown')
  })

  it('buckets duration and posting_time features', () => {
    expect(extractFeature('duration', { duration: '45' })).toBe('31-60s')
    expect(extractFeature('posting_time', { posting_time: '2026-08-19T07:00:00Z' })).toBe('prime')
  })
})