/**
 * Unit tests for raas-quota-response-builder
 * @module forest/raas/__tests__/raas-quota-response-builder.test
 */

import { describe, it, expect } from 'vitest';
import { buildQuotaExceededResponse, buildQuotaErrorResponse } from '../raas-quota-response-builder';

const mockDenied = {
  error: 'quota_exceeded',
  code: 'QUOTA_EXCEEDED',
  message: 'Monthly usage limit reached',
  exceeded: { type: 'monthly_credits', limit: 10000 },
  remaining: { monthlyCredits: 0 },
  retryAfter: 3600,
  upgradeUrl: '/dashboard/billing',
};

describe('buildQuotaExceededResponse', () => {
  it('returns 429 response with correct structure', async () => {
    const response = buildQuotaExceededResponse(mockDenied);
    expect(response.status).toBe(429);

    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.error).toBe('quota_exceeded');
    expect(body.code).toBe('QUOTA_EXCEEDED');
    expect(body.exceeded).toEqual({ type: 'monthly_credits', limit: 10000 });
    expect(body.remaining).toEqual({ monthlyCredits: 0 });
    expect(body.retry_after).toBe(3600);
    expect(body.upgrade_url).toBe('/dashboard/billing');
  });

  it('includes dunning fields when provided', async () => {
    const withDunning = {
      ...mockDenied,
      dunningState: 'overdue',
      dunningReason: 'payment_failed',
    };
    const response = buildQuotaExceededResponse(withDunning);
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.dunning_state).toBe('overdue');
    expect(body.dunning_reason).toBe('payment_failed');
  });

  it('sets retry headers correctly', () => {
    const response = buildQuotaExceededResponse(mockDenied);
    expect(response.headers.get('Retry-After')).toBe('3600');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10000');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('uses default values when fields are missing', async () => {
    const minimal = {
      exceeded: { type: 'hourly_credits' as string },
      remaining: {},
    } as never;
    const response = buildQuotaExceededResponse(minimal);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.error).toBe('quota_exceeded');
    expect(body.code).toBe('QUOTA_EXCEEDED');
  });
});

describe('buildQuotaErrorResponse', () => {
  it('returns 503 response', async () => {
    const response = buildQuotaErrorResponse();
    expect(response.status).toBe(503);

    const body = JSON.parse(await response.text()) as Record<string, unknown>;
    expect(body.error).toBe('Quota check failed');
    expect(body.code).toBe('quota_check_error');
  });

  it('includes retry-after header', () => {
    const response = buildQuotaErrorResponse();
    expect(response.headers.get('Retry-After')).toBe('30');
  });
});
