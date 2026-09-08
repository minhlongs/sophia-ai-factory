/**
 * Unit tests for creative-job-economics pure functions.
 *
 * @module seed/types/__tests__/creative-job-economics
 */

import { describe, it, expect } from 'vitest';
import {
  classifyCost,
  computeGrossMargin,
  CostClassification,
  ErrorCategory,
  classifyErrorForJob,
} from '../creative-job-economics';

describe('classifyCost', () => {
  it('returns METERED when numeric cost is provided', () => {
    expect(classifyCost(150, false)).toBe(CostClassification.METERED);
    expect(classifyCost(0, false)).toBe(CostClassification.METERED);
  });

  it('returns UNMETERED when no cost but has explicit meter', () => {
    expect(classifyCost(null, true)).toBe(CostClassification.UNMETERED);
    expect(classifyCost(undefined, true)).toBe(CostClassification.UNMETERED);
  });

  it('returns UNKNOWN when no cost and no meter', () => {
    expect(classifyCost(null, false)).toBe(CostClassification.UNKNOWN);
    expect(classifyCost(undefined, false)).toBe(CostClassification.UNKNOWN);
  });
});

describe('computeGrossMargin', () => {
  it('calculates gross margin percentage (test 7)', () => {
    // ((500 - 100) / 500) * 100 = 80
    expect(computeGrossMargin(100, 500)).toBe(80);
  });

  it('returns null when cost is null (test 8)', () => {
    expect(computeGrossMargin(null, 500)).toBeNull();
  });

  it('returns null when revenue is null', () => {
    expect(computeGrossMargin(100, null)).toBeNull();
  });

  it('returns null when revenue is zero', () => {
    expect(computeGrossMargin(100, 0)).toBeNull();
  });
});

describe('classifyErrorForJob', () => {
  it('classifies 401 as AUTH', () => {
    expect(classifyErrorForJob(new Error('HTTP 401 unauthorized'))).toBe(ErrorCategory.AUTH);
  });

  it('classifies 429 as RATE_LIMIT', () => {
    expect(classifyErrorForJob(new Error('HTTP 429 rate limit exceeded'))).toBe(
      ErrorCategory.RATE_LIMIT,
    );
  });

  it('classifies timeout as TIMEOUT', () => {
    expect(classifyErrorForJob(new Error('Request timed out'))).toBe(ErrorCategory.TIMEOUT);
  });

  it('classifies 500 as PROVIDER', () => {
    expect(classifyErrorForJob(new Error('HTTP 500 internal'))).toBe(ErrorCategory.PROVIDER);
  });

  it('classifies network errors as NETWORK', () => {
    expect(classifyErrorForJob(new Error('ECONNREFUSED'))).toBe(ErrorCategory.NETWORK);
  });

  it('classifies unknown errors as UNKNOWN', () => {
    expect(classifyErrorForJob(new Error('something weird happened'))).toBe(ErrorCategory.UNKNOWN);
  });
});
