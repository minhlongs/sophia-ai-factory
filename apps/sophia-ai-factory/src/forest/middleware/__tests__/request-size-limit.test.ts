/**
 * @module middleware/request-size-limit
 * Unit tests for request size limiting middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import type { NextRequest, NextResponse } from 'next/server';
import {
  isWebhookRoute,
  getSizeLimit,
  rejectOversizedRequest,
  MAX_REQUEST_SIZE,
  MAX_WEBHOOK_SIZE,
} from '@/forest/middleware/request-size-limit';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(contentLength: string | null): NextRequest {
  const headers = new Headers();
  if (contentLength) headers.set('content-length', contentLength);
  return {
    headers,
  } as unknown as NextRequest;
}

// ─── isWebhookRoute ───────────────────────────────────────────────────────────

describe('isWebhookRoute', () => {
  it('returns true for /api/webhooks/*', () => {
    expect(isWebhookRoute('/api/webhooks/heygen')).toBe(true);
    expect(isWebhookRoute('/api/webhooks/nowpayments')).toBe(true);
    expect(isWebhookRoute('/api/webhooks/telegram')).toBe(true);
  });

  it('returns false for non-webhook routes', () => {
    expect(isWebhookRoute('/api/v1/missions')).toBe(false);
    expect(isWebhookRoute('/api/cron/d1-backup')).toBe(false);
    expect(isWebhookRoute('/api/health')).toBe(false);
    expect(isWebhookRoute('/dashboard')).toBe(false);
  });

  it('returns false for root path', () => {
    expect(isWebhookRoute('/')).toBe(false);
  });
});

// ─── getSizeLimit ────────────────────────────────────────────────────────

describe('getSizeLimit', () => {
  it('returns webhook limit for webhook routes', () => {
    expect(getSizeLimit('/api/webhooks/heygen')).toBe(MAX_WEBHOOK_SIZE);
  });

  it('returns default limit for non-webhook routes', () => {
    expect(getSizeLimit('/api/v1/missions')).toBe(MAX_REQUEST_SIZE);
    expect(getSizeLimit('/api/cron/d1-backup')).toBe(MAX_REQUEST_SIZE);
  });

  it('returns correct byte values', () => {
    expect(MAX_REQUEST_SIZE).toBe(10 * 1024 * 1024); // 10MB
    expect(MAX_WEBHOOK_SIZE).toBe(50 * 1024 * 1024); // 50MB
  });
});

// ─── rejectOversizedRequest ───────────────────────────────────────────────────

describe('rejectOversizedRequest', () => {
  it('returns null when no Content-Length header', () => {
    const req = makeRequest(null);
    const result = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(result).toBeNull();
  });

  it('returns null when request is within limit', () => {
    const req = makeRequest(String(1024)); // 1KB
    const result = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(result).toBeNull();
  });

  it('returns 413 response when request exceeds limit', async () => {
    const oversized = MAX_REQUEST_SIZE + 1;
    const req = makeRequest(String(oversized));
    const result = rejectOversizedRequest(req, MAX_REQUEST_SIZE);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
    const body = (await result!.json()) as { error: string; detail: string };
    expect(body.error).toBe('Payload too large');
    expect(body.detail).toContain(String(oversized));
    expect(body.detail).toContain(String(MAX_REQUEST_SIZE));
  });

  it('returns 413 for webhook exceeding webhook limit', async () => {
    const oversized = MAX_WEBHOOK_SIZE + 1;
    const req = makeRequest(String(oversized));
    const result = rejectOversizedRequest(req, MAX_WEBHOOK_SIZE);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(413);
  });

  it('allows request at exactly the limit', () => {
    const req = makeRequest(String(MAX_REQUEST_SIZE));
    const result = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(result).toBeNull();
  });

  it('handles non-numeric Content-Length gracefully', () => {
    const req = makeRequest('not-a-number');
    const result = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(result).toBeNull();
  });

  it('handles negative Content-Length gracefully', () => {
    const req = makeRequest('-1');
    const result = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(result).toBeNull();
  });
});
