import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  MAX_REQUEST_SIZE,
  MAX_WEBHOOK_SIZE,
  isWebhookRoute,
  getSizeLimit,
  rejectOversizedRequest,
} from '../request-size-limit';

describe('Request size limit middleware', () => {
  it('correctly identifies webhook routes vs standard routes', () => {
    expect(isWebhookRoute('/api/webhooks/nowpayments')).toBe(true);
    expect(isWebhookRoute('/api/webhooks/stripe')).toBe(true);
    expect(isWebhookRoute('/api/v1/missions')).toBe(false);
    expect(isWebhookRoute('/dashboard')).toBe(false);
  });

  it('provides 50MB limit for webhooks and 10MB limit for general API routes', () => {
    expect(getSizeLimit('/api/webhooks/payos')).toBe(MAX_WEBHOOK_SIZE);
    expect(getSizeLimit('/api/v1/missions')).toBe(MAX_REQUEST_SIZE);
  });

  it('allows requests with no content-length header', () => {
    const req = new NextRequest('http://localhost/api/v1/missions');
    const res = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(res).toBeNull();
  });

  it('allows requests within the size limit', () => {
    const req = new NextRequest('http://localhost/api/v1/missions', {
      headers: { 'content-length': String(1024 * 1024) }, // 1MB
    });
    const res = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(res).toBeNull();
  });

  it('rejects oversized requests with 413 Payload Too Large', () => {
    const oversizedBytes = MAX_REQUEST_SIZE + 100;
    const req = new NextRequest('http://localhost/api/v1/missions', {
      headers: { 'content-length': String(oversizedBytes) },
    });
    const res = rejectOversizedRequest(req, MAX_REQUEST_SIZE);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(413);
  });
});
