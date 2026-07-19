/**
 * Unit tests for quota-response builder
 * @module forest/worker/__tests__/quota-response.test
 */

import { describe, it, expect } from 'vitest';
import {
  buildQuotaExceededResponse,
  buildQuotaInfoHeaders,
  parseRetryAfter,
  isQuotaExceededResponse,
  extractQuotaInfo,
} from '../lib/quota-response';

const mockOverage = {
  overageCount: 200,
  overageFee: 10,
  isOverHardLimit: false,
  tier: 'BASIC',
  baseLimit: 1000,
  currentUsage: 1200,
  remaining: 0,
};

describe('buildQuotaExceededResponse', () => {
  it('returns 429 response with correct body', async () => {
    const response = buildQuotaExceededResponse(mockOverage);
    expect(response.status).toBe(429);

    const body = JSON.parse(await response.clone().text()) as Record<string, unknown>;
    expect(body.error).toBe('quota_exceeded');
    expect(body.code).toBe('QUOTA_EXCEEDED');
    expect(body.exceeded).toEqual({ type: 'monthly_credits', limit: 1000, current: 1200 });
  });

  it('includes overage details when overageCount > 0', async () => {
    const response = buildQuotaExceededResponse(mockOverage);
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.overage).toEqual({ count: 200, fee: 10, isOverHardLimit: false });
  });

  it('omits overage details when overageCount is 0', async () => {
    const noOverage = { ...mockOverage, overageCount: 0, overageFee: 0 };
    const response = buildQuotaExceededResponse(noOverage);
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.overage).toBeUndefined();
  });

  it('uses custom retry-after and upgrade URL when provided', () => {
    const response = buildQuotaExceededResponse(mockOverage, 7200, '/upgrade');
    expect(response.headers.get('Retry-After')).toBe('7200');
  });

  it('sets hard limit message when over limit', async () => {
    const hardLimit = { ...mockOverage, isOverHardLimit: true };
    const response = buildQuotaExceededResponse(hardLimit);
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.message).toBe('Monthly usage limit exceeded. Hard limit reached.');
  });

  it('includes rate limit headers', () => {
    const response = buildQuotaExceededResponse(mockOverage);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Overage-Count')).toBe('200');
    expect(response.headers.get('X-RateLimit-Overage-Fee')).toBe('10');
    expect(response.headers.get('X-RateLimit-Hard-Limit')).toBe('false');
  });
});

describe('buildQuotaInfoHeaders', () => {
  it('returns headers with correct values', () => {
    const headers = buildQuotaInfoHeaders(mockOverage);
    expect(headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('adds overage headers when overageCount > 0', () => {
    const overage = { ...mockOverage, remaining: 800 };
    const headers = buildQuotaInfoHeaders(overage);
    expect(headers.get('X-RateLimit-Overage-Count')).toBe('200');
    expect(headers.get('X-RateLimit-Overage-Fee')).toBe('10');
  });

  it('omits overage headers when overageCount is 0', () => {
    const noOverage = { ...mockOverage, overageCount: 0, overageFee: 0, remaining: 1000 };
    const headers = buildQuotaInfoHeaders(noOverage);
    expect(headers.get('X-RateLimit-Overage-Count')).toBeNull();
    expect(headers.get('X-RateLimit-Overage-Fee')).toBeNull();
  });
});

describe('parseRetryAfter', () => {
  it('parses numeric seconds', () => {
    expect(parseRetryAfter('3600')).toBe(3600);
  });

  it('returns default for null input', () => {
    expect(parseRetryAfter(null)).toBe(2592000);
  });

  it('returns default for empty string', () => {
    expect(parseRetryAfter('')).toBe(2592000);
  });

  it('returns default for invalid string', () => {
    expect(parseRetryAfter('not-a-number')).toBe(2592000);
  });
});

describe('isQuotaExceededResponse', () => {
  it('returns true for 429 with zero remaining', () => {
    const response = buildQuotaExceededResponse(mockOverage);
    expect(isQuotaExceededResponse(response)).toBe(true);
  });

  it('returns false for non-429 response', () => {
    const response = new Response('OK', { status: 200 });
    expect(isQuotaExceededResponse(response)).toBe(false);
  });

  it('returns false for 429 without zero remaining', () => {
    const response = new Response(JSON.stringify({}), {
      status: 429,
      headers: { 'X-RateLimit-Remaining': '5' },
    });
    expect(isQuotaExceededResponse(response)).toBe(false);
  });
});

describe('extractQuotaInfo', () => {
  it('extracts info from response headers', () => {
    const response = buildQuotaExceededResponse(mockOverage);
    const info = extractQuotaInfo(response);
    expect(info).not.toBeNull();
    expect(info!.limit).toBe(1000);
    expect(info!.remaining).toBe(0);
    expect(info!.resetDate).toBeTruthy();
  });

  it('returns null when headers are missing', () => {
    const response = new Response('OK', { status: 200 });
    expect(extractQuotaInfo(response)).toBeNull();
  });

  it('extracts overage info when present', () => {
    const response = buildQuotaExceededResponse(mockOverage);
    const info = extractQuotaInfo(response);
    expect(info!.overageCount).toBe(200);
    expect(info!.overageFee).toBe(10);
  });
});
